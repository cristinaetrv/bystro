// TODO: replace panics with proper error handling
// TODO: Cache genotypes
use std::io;
use std::io::prelude::*;
use std::thread;

use atoi::FromRadix10;
use crossbeam_channel::unbounded;
use hashbrown::HashMap;
use itoa;
use memchr::memchr;
use num_cpus;

use std::sync::Arc;

#[macro_use]
extern crate log;

const CHROM_IDX: usize = 0;
const POS_IDX: usize = 1;
// const ID_IDX: usize = 2;
const REF_IDX: usize = 3;
const ALT_IDX: usize = 4;
// const QUAL_IDX: usize = 5;
const FILTER_IDX: usize = 6;
// const INFO_IDX: usize = 7;
const FORMAT_IDX: usize = 8;

const NOT_TSTV: u8 = b'0';
const TS: u8 = b'1';
const TV: u8 = b'2';

const SNP: &[u8] = b"SNP";
const INS: &[u8] = b"INS";
const DEL: &[u8] = b"DEL";
const MNP: &[u8] = b"MNP";
const MULTI: &[u8] = b"MULTIALLELIC";

// const site_types: &[[u8]] = [SNP, INS, DEL, MNP, MULTI];
const SITE_TYPES: [&[u8]; 5] = [SNP, INS, DEL, MNP, MULTI];

const SNP_IDX: u8 = 0;
const INS_IDX: u8 = 1;
const DEL_IDX: u8 = 2;
const MNP_IDX: u8 = 3;
const MULTI_IDX: u8 = 4;

const A: u8 = b'A';
const C: u8 = b'C';
const G: u8 = b'G';
const T: u8 = b'T';

static TSTV: [[u8; 256]; 256] = {
    let mut all: [[u8; 256]; 256] = [[0u8; 256]; 256];

    all[G as usize][A as usize] = TS;
    all[A as usize][G as usize] = TS;
    all[C as usize][T as usize] = TS;
    all[T as usize][C as usize] = TS;

    all[C as usize][A as usize] = TV;
    all[T as usize][A as usize] = TV;
    all[C as usize][G as usize] = TV;
    all[T as usize][G as usize] = TV;

    all[A as usize][T as usize] = TV;
    all[G as usize][T as usize] = TV;
    all[A as usize][C as usize] = TV;
    all[G as usize][C as usize] = TV;

    all
};

// fn get_output_header() -> Vec<Vec<u8>> {
//     vec![b"chrom", b"pos", b"type", b"ref", b"alt", b"trTv", b"heterozygotes", b"heterozygosity", b"homozygotes",
//         b"homozygosity", b"missingGenos", b"missingness", b"ac", b"an", b"sampleMaf"]
// }
// TODO: Add error handling
fn get_header_and_num_eol_chars<T: BufRead>(reader: &mut T) -> (Vec<u8>, usize) {
    let mut buf = Vec::new();
    let len = reader.read_until(b'\n', &mut buf).unwrap();

    if len == 0 {
        panic!("Empty file")
    }

    if !buf.starts_with(b"##fileformat=VCFv4") {
        panic!(
            "File format not supported: {}",
            std::str::from_utf8(&buf).unwrap()
        );
    }

    loop {
        buf.clear();
        reader.read_until(b'\n', &mut buf).unwrap();

        if buf.starts_with(b"#CHROM") {
            break;
        }

        if buf[0] != b'#' {
            panic!("Not a VCF file")
        }
    }

    let len = buf.len();

    if buf[len - 2] == b'\r' {
        return (buf, 2);
    }

    (buf, 1)
}

#[inline(always)]
fn snp_is_valid(alt: u8) -> bool {
    alt == b'A' || alt == b'G' || alt == b'C' || alt == b'T'
}

fn alt_is_valid(alt: &[u8]) -> bool {
    if !snp_is_valid(alt[0]) {
        return false;
    }

    for i in 1..alt.len() {
        if !snp_is_valid(alt[i]) {
            return false;
        }
    }

    true
}

#[inline(always)]
fn filter_passes(
    filter_field: &[u8],
    allowed_filters: &HashMap<&[u8], bool>,
    excluded_filters: &HashMap<&[u8], bool>,
) -> bool {
    (allowed_filters.len() == 0 || allowed_filters.contains_key(filter_field))
        && (excluded_filters.len() == 0 || !excluded_filters.contains_key(filter_field))
}

trait Variant {
    fn write_to_buf(&self, buffer: &mut Vec<u8>);
}

struct SnpType<'a> {
    position: &'a [u8],
    alternate: u8,
    reference: u8,
}

impl<'a> Variant for SnpType<'a> {
    fn write_to_buf(&self, buffer: &mut Vec<u8>) {}
}

// pos, refr[1], 1 - refr.len() as i32
struct DelType {
    position: u32,
    alternate: i32,
    reference: u8,
}

impl Variant for DelType {
    fn write_to_buf(&self, buffer: &mut Vec<u8>) {}
}

struct InsType<'a> {
    position: u32,
    alternate: &'a [u8],
    reference: u8,
}

impl<'a> Variant for InsType<'a> {
    fn write_to_buf(&self, buffer: &mut Vec<u8>) {}
}

enum VariantEnum<'a> {
    SNP(SnpType<'a>),
    INS(InsType<'a>),
    DEL(DelType),
    MNP(Vec<SnpType<'a>>),
    None,
}

// #[derive(Debug)]
enum SiteEnum<'a> {
    MonoAllelic(VariantEnum<'a>),
    MultiAllelic(Vec<VariantEnum<'a>>),
    None,
}

fn get_alleles<'a>(pos: &'a [u8], refr: &'a [u8], alt: &'a [u8]) -> SiteEnum<'a> {
    if alt.len() == 1 {
        if !snp_is_valid(alt[0]) {
            return SiteEnum::None;
        }

        if refr.len() == 1 {
            return SiteEnum::MonoAllelic(VariantEnum::SNP(SnpType {
                position: pos,
                reference: refr[0],
                alternate: alt[0],
            }));
        }

        // simple deletion must have 1 base padding match
        if alt[0] != refr[0] {
            // TODO: Error
            return SiteEnum::None;
        }

        // pos is the next base over (first deleted base)
        // ref is also the first deleted base, since alt is of 1 padding, that's idx 1 (2nd ref base)
        // alt == len(alt) - len(ref) for len(alt) < len(ref)
        // example: alt = A (len == 1), ref = AAATCC (len == 6)
        // 1 - 6 = -5 (then conver to string)
        let pos = u32::from_radix_10(pos).0;
        return SiteEnum::MonoAllelic(VariantEnum::DEL(DelType {
            position: pos + 1,
            reference: refr[1],
            alternate: 1 - refr.len() as i32,
        }));
    } else if refr.len() == 1 && memchr(b',', alt) == None {
        if !alt_is_valid(alt) {
            return SiteEnum::None;
        }

        if alt[0] != refr[0] {
            return SiteEnum::None;
        }
        let pos = u32::from_radix_10(pos).0;
        return SiteEnum::MonoAllelic(VariantEnum::INS(InsType {
            position: pos,
            reference: refr[0],
            alternate: &alt[1..alt.len()],
        }));
    }

    let mut variants: Vec<VariantEnum> = Vec::new();

    let mut n_valid_alleles: u32 = 0;
    let refr_len = refr.len() as i32;
    let mut r_idx: i32;
    let mut talt_len: i32;

    let pos_num = u32::from_radix_10(pos).0;

    for t_alt in alt.split(|byt| *byt == b',') {
        if !alt_is_valid(t_alt) {
            variants.push(VariantEnum::None);
            continue;
        }

        if refr.len() == 1 {
            if t_alt[0] != refr[0] {
                // TODO: grab chromosome in message, store number skipped
                // eprint!("{:?}: skipping: first base of ref didn't match alt: {:?}, {:?}", pos, t_alt, refr);
                variants.push(VariantEnum::None);
                continue;
            }

            if t_alt.len() == 1 {
                variants.push(VariantEnum::SNP(SnpType {
                    position: pos,
                    reference: refr[0],
                    alternate: t_alt[0],
                }));
                n_valid_alleles += 1;
                continue;
            }

            // Pos doesn't change, as pos in output refers to first ref base
            let ins = &t_alt[1..t_alt.len()];

            variants.push(VariantEnum::INS(InsType {
                position: pos_num,
                reference: refr[0],
                alternate: ins,
            }));
            n_valid_alleles += 1;

            continue;
        }

        if alt.len() == 1 {
            if t_alt[0] != refr[0] {
                // TODO: log
                variants.push(VariantEnum::None);
                continue;
            }

            // We use 0 padding for deletions, showing 1st deleted base as ref
            // Therefore need to shift pos & ref by 1
            variants.push(VariantEnum::DEL(DelType {
                position: pos_num + 1,
                reference: refr[1],
                alternate: 1 - refr.len() as i32,
            }));
            n_valid_alleles += 1;

            continue;
        }

        // If we're here, ref and alt are both > 1 base long
        // could be a weird SNP (multiple bases are SNPS, len(ref) == len(alt))
        // could be a weird deletion/insertion
        // could be a completely normal multiallelic (due to padding, shifted)
        // We return these as VariantEnum::Multiallelic but if it proves to be a snp, mnp, ins, or del
        // we label it as such

        //1st check for MNPs and extra-padding SNPs
        if refr.len() == t_alt.len() {
            let mut mnp_alleles: Vec<SnpType> = Vec::with_capacity(t_alt.len());
            for i in 0..refr.len() {
                if refr[i] != t_alt[i] {
                    // A bit slower, but simpler by union with simple snp
                    let mut pos_buf = Vec::new();
                    itoa::write(&mut pos_buf, pos_num + i as u32).unwrap();

                    mnp_alleles.push(SnpType {
                        position: pos_buf.as_slice(),
                        reference: refr[i],
                        alternate: t_alt[i],
                    })
                }
            }

            if mnp_alleles.len() == 0 {
                variants.push(VariantEnum::None);
                continue;
            }

            if mnp_alleles.len() == 1 {
                variants.push(VariantEnum::SNP(mnp_alleles[0]));
                n_valid_alleles += 1;
            } else {
                variants.push(VariantEnum::MNP(mnp_alleles));
                n_valid_alleles += 1;
            }

            continue;
        }

        // Find the allele representation that minimizes padding, while still checking
        // that the site isn't a mixed type (indel + snp) and checking for intercolation
        // Essentially, Occam's Razor for padding: minimize the number of steps away
        // from left edge to explan the allele
        // EX:
        // If ref == AATCG
        // If alt == AG
        // One interpretation of this site is mixed A->G -3 (-TCG)
        // Another is -3 (-ATC) between the A (0-index) and G (4-index) in ref
        // We prefer the latter approach
        // Ex2: ref: TT alt: TCGATT
        // We prefer +CGAT

        // Like http://www.cureffi.org/2014/04/24/converting-genetic-variants-to-their-minimal-representation/
        // we will use a simple heuristic:
        // 1) For insertions, figure out the shared right edge, from 1 base downstream of first ref base
        // Then, check if the remaining ref bases match the left edge of the alt
        // If they don't, skip that site
        // 2) For deletions, the same, except replace the role of ref with the tAlt

        // Our method should be substantially faster, since we don't need to calculate
        // the min(len(ref), len(tAlt))
        // and because we don't create a new slice for every shared ref/alt at right edges and left

        r_idx = 0;
        talt_len = t_alt.len() as i32;
        let offset: usize;
        if t_alt.len() > refr.len() {
            while talt_len + r_idx > 0
                && refr_len + r_idx > 1
                && t_alt[{ talt_len + r_idx - 1 } as usize]
                    == refr[{ refr_len + r_idx - 1 } as usize]
            {
                r_idx -= 1;
            }

            // Then, we require an exact match from left edge, for the difference between the
            // length of the ref, and the shared suffix
            // Ex: alt: TAGCTT ref: TAT
            // We shared 1 base at right edge, so expect that len(ref) - 1, or 3 - 1 = 2 bases of ref
            // match the left edge of alt
            // Here that is TA, for an insertion of +GCT
            // Ex2: alt: TAGCAT ref: TAT
            // Here the AT of the ref matches the last 2 bases of alt
            // So we expect len(ref) - 2 == 1 base of ref to match left edge of the alt (T), for +AGC
            // Ex3: alt TAGTAT ref: TAT
            // Since our loop doesn't check the last base of ref, as in ex2, +AGC
            // This mean we always prefer a 1-base padding, when possible
            // Ex4: alt TAGTAT ref: TGG
            // In this case, we require len(ref) - 0 bases in the ref to match left edge of alt
            // Since they don't (TAG != TGG), we call this complex and move on

            // Insertion
            // If pos is 100 and ref is AATCG
            // and alt is AAAAATCG (len == 7)
            // we expect lIdx to be 2
            // and rIdx to be -3
            // alt[2] is the first non-ref base
            // and alt[len(alt) - 3] == alt[4] is the last non-ref base
            // The position is intPos + lIdx or 100 + 2 - 1 == 101 (100, 101 are padding bases,
            // and we want to keep the last reference base
            // The ref is ref[2 - 1] or ref[1]
            offset = { refr_len + r_idx } as usize;

            // TODO: DO we need this check
            // if refr[0..offset] != t_alt[0..offset] {
            //     println!("WTF");
            //     continue;
            // }

            // position is offset by len(ref) + 1 - rIdx
            // ex1: alt: TAGCTT ref: TAT
            // here we match the first base, so -1
            // we require remainder of left edge to be present,
            // or len(ref) - 1 == 2
            // so intPos + 2 - 1 for last padding base (the A in TA) (intPos + 2 is first unique base)

            // Similarly, the alt allele starts from len(ref) + rIdx, and ends at len(tAlt) + rIdx
            // from ex: TAGCTT ref: TAT :
            // rIdx == -1 , real alt == tAlt[len(ref) - 1:len(tAlt) - 1] == tALt[2:5]
            let ins = &t_alt[offset..{ talt_len + r_idx } as usize];

            variants.push(VariantEnum::INS(InsType {
                position: pos_num + offset as u32 - 1,
                reference: refr[offset - 1],
                alternate: ins,
            }));
            n_valid_alleles += 1;

            continue;
        }

        // Deletion
        // If pos is 100 and alt is AATCG
        // and ref is AAAAATCG (len == 7)
        // we expect lIdx to be 2
        // and rIdx to be -3
        // and alt is -3 or len(ref) + rIdx - lIdx == 8 + -3 - 2
        // position is the first deleted base, or intPos + lIdx == 100 + 2 == 102
        // where (100, 101) are the two padding bases
        // ref is the first deleted base or ref[lIdx] == ref[2]

        // Just like insertion, but try to match all bases from 1 base downstream of tAlt to ref
        // let mut r_idx = 0;
        while talt_len + r_idx > 1
            && refr_len + r_idx > 0
            && t_alt[{ talt_len + r_idx - 1 } as usize] == refr[{ refr_len + r_idx - 1 } as usize]
        {
            r_idx -= 1;
        }

        offset = { talt_len + r_idx } as usize;

        // reference: we want the base after the last shared
        variants.push(VariantEnum::DEL(DelType {
            position: pos_num + offset as u32,
            reference: refr[offset],
            alternate: -(refr_len + r_idx - offset as i32),
        }));
        n_valid_alleles += 1;
    }

    if n_valid_alleles == 0 {
        return SiteEnum::None;
    }

    if variants.len() > 1 {
        return SiteEnum::MultiAllelic(variants);
    }

    // A single allele

    // A 1 allele site where the variant was an MNP
    // They may be sparse or complete, so we empirically check for their presence
    // If the MNP is really just a snp, there is only 1 allele, and reduces to snp
    // > 1, these are labeled differently to allow people to jointly consider the effects
    // of the array of SNPs, since we at the moment consider their effects only independently
    // (which has advantages for CADD, phyloP, phastCons, clinvar, etc reporting)
    // SiteEnum::MonoAllelic
    match variants[0] {
        VariantEnum::SNP(v) => SiteEnum::MonoAllelic(VariantEnum::SNP(v)),
        VariantEnum::DEL(v) => SiteEnum::MonoAllelic(VariantEnum::DEL(v)),
        VariantEnum::INS(v) => SiteEnum::MonoAllelic(VariantEnum::INS(v)),
        VariantEnum::MNP(v) => SiteEnum::MonoAllelic(VariantEnum::MNP(v)),
        VariantEnum::None => SiteEnum::None,
    }
}

fn write_samples_type(
    header: &[Vec<u8>],
    samples: &[u32],
    n_samples: f32,
    buffer: &mut Vec<u8>,
    f_buf: &mut [u8; 15],
) {
    if samples.is_empty() {
        buffer.push(b'!');
        buffer.push(b'\t');
        buffer.push(b'0');
        return;
    }

    for (idx, sample_idx) in samples.iter().enumerate() {
        buffer.extend_from_slice(&header[*sample_idx as usize]);

        if idx < samples.len() - 1 {
            buffer.push(b';');
        }
    }

    buffer.push(b'\t');

    write_f32(buffer, samples.len() as f32 / n_samples, f_buf);
}

fn write_ac_an(buffer: &mut Vec<u8>, ac: u32, an: u32, bytes: &mut Vec<u8>, f_buf: &mut [u8; 15]) {
    if ac == 0 {
        buffer.push(b'0');
        buffer.push(b'\t');
    } else {
        write_int(buffer, ac, bytes);
        buffer.push(b'\t');
    }
    write_int(buffer, an, bytes);
    buffer.push(b'\t');
    write_f32(buffer, ac as f32 / an as f32, f_buf);
}

fn write_int<T: itoa::Integer>(buffer: &mut Vec<u8>, val: T, mut b: &mut Vec<u8>) {
    itoa::write(&mut b, val).unwrap();
    buffer.extend_from_slice(&b);
    b.clear();
}

fn write_f32(buffer: &mut Vec<u8>, val: f32, f_buf: &mut [u8; 15]) {
    unsafe {
        let n = ryu::raw::f2s_buffered_n(val, &mut f_buf[0]);
        buffer.extend_from_slice(&f_buf[0..n]);
    };
}

#[allow(clippy::too_many_arguments)]
fn write_samples(
    header: &[Vec<u8>],
    buffer: &mut Vec<u8>,
    hets: &[u32],
    homs: &[u32],
    missing: &[u32],
    effective_samples: f32,
    n_samples: u32,
    ac: u32,
    an: u32,
    bytes: &mut Vec<u8>,
    f_buf: &mut [u8; 15],
) {
    write_samples_type(header, hets, effective_samples, buffer, f_buf);

    buffer.push(b'\t');

    write_samples_type(header, homs, effective_samples, buffer, f_buf);

    buffer.push(b'\t');

    write_samples_type(header, missing, n_samples as f32, buffer, f_buf);

    buffer.push(b'\t');

    write_ac_an(buffer, ac, an, bytes, f_buf);
}

fn write_samples_empty(buffer: &mut Vec<u8>) {
    buffer.push(b'\t');

    buffer.push(b'!');
    buffer.push(b'\t');

    buffer.push(b'!');
    buffer.push(b'\t');

    buffer.push(b'!');
    buffer.push(b'\t');

    buffer.push(b'0');
    buffer.push(b'\t');

    buffer.push(b'0');
    buffer.push(b'\t');

    buffer.push(b'0');
}

#[inline]
fn write_chrom(buffer: &mut Vec<u8>, chrom: &[u8]) {
    if chrom[0] != b'c' {
        buffer.extend_from_slice(b"chr");
    }

    buffer.extend_from_slice(&chrom);
}

// fn write_by_alt(&buffer, pos, refr, alt) {

//                     buffer.extend_from_slice(site_type);
//                     buffer.push(b'\t');
//                     buffer.push(t_refr[i]);
//                     buffer.push(b'\t');
//                     buffer.extend_from_slice(&t_alt[i]);
//                     buffer.push(b'\t');
//                     buffer.push(NOT_TSTV);
//                     buffer.push(b'\t');
// }

// #[inline]
// fn simple_ge
#[allow(clippy::cognitive_complexity)]
fn process_lines(header: &[Vec<u8>], rows: &[Vec<u8>]) -> usize {
    let n_samples = if header.len() > 9 {
        header.len() as u32 - 9
    } else {
        0
    };

    let mut homs: Vec<Vec<u32>> = Vec::new();
    let mut hets: Vec<Vec<u32>> = Vec::new();

    // Even in multiallelic case, missing in one means missing in all
    let mut missing: Vec<u32> = Vec::new();
    let mut ac: Vec<u32> = Vec::new();
    // let mut genotype_cache: HashMap<&[u8], (Vec<u8>)>;
    let mut an: u32 = 0;

    let mut allowed_filters: HashMap<&[u8], bool> = HashMap::new();
    allowed_filters.insert(b".", true);
    allowed_filters.insert(b"PASS", true);

    let excluded_filters: HashMap<&[u8], bool> = HashMap::new();
    let mut n_count = 0;
    // let mut simple_gt = false;

    let mut chrom: &[u8] = b"";
    let mut pos: &[u8] = b"";
    let mut refr: &[u8] = b"";
    let mut alt: &[u8] = b"";

    let mut buffer = Vec::with_capacity(10_000);

    let mut bytes = Vec::new();
    let mut f_buf: [u8; 15];
    unsafe {
        f_buf = std::mem::uninitialized();
    }

    let mut effective_samples: f32;
    let mut alleles: SiteEnum;

    'row_loop: for row in rows {
        alleles = SiteEnum::None;
        n_count += 1;

        'field_loop: for (idx, field) in row.split(|byt| *byt == b'\t').enumerate() {
            if idx == CHROM_IDX {
                chrom = field;
                continue;
            }

            if idx == POS_IDX {
                pos = field;
                continue;
            }

            if idx == REF_IDX {
                refr = field;
                continue;
            }

            if idx == ALT_IDX {
                alt = field;
                continue;
            }

            if idx == FILTER_IDX {
                if !filter_passes(field, &allowed_filters, &excluded_filters) {
                    break;
                }

                alleles = get_alleles(pos, refr, alt);

                // TODO: This isn't quite right
                let allele_num: usize;
                match &alleles {
                    SiteEnum::None => {
                        // TODO: LOG
                        continue 'row_loop;
                    }
                    SiteEnum::MultiAllelic(variants) => {
                        allele_num = variants.len();
                    }
                    _ => {
                        allele_num = 1;
                    }
                }

                // No more variant-related work after FILTER_IDX,
                // until we start using QUAL
                if n_samples == 0 {
                    break;
                }

                an = 0;
                ac = vec![0; allele_num];

                missing.clear();
                hets = vec![Vec::new(); allele_num];
                homs = vec![Vec::new(); allele_num];

                continue;
            }

            if idx > FORMAT_IDX {
                match &alleles {
                    SiteEnum::MultiAllelic(variants) => {
                        let mut local_alt_indices_counts = HashMap::new();
                        let mut local_an_count = 0;
                        let mut gt: Vec<u8> = Vec::new();
                        for &chr in field.iter() {
                            if chr == b'/' || chr == b'|' || chr == b':' {
                                if gt[0] == b'0' {
                                    local_an_count += 1;

                                    if chr == b':' {
                                        break;
                                    }

                                    gt.clear();
                                    continue;
                                }

                                let gtn = usize::from_radix_10(&gt);

                                if gtn.1 == 0 {
                                    eprintln!(
                                        "{:?}:{:?}: skipping: couldn't parse genotype {:?} for sample {:?}",
                                        chrom, pos, gt, header[idx]
                                    );

                                    continue 'row_loop;
                                }

                                let alt_idx = gtn.0 - 1;
                                // maybe prepended with MNP-, and then deconvolve when writing
                                // Currently we're counting against an
                                // TODO: We can't just index into local_ac_count
                                match variants[alt_idx as usize] {
                                    VariantEnum::None => continue,
                                    _ => {
                                        local_an_count += 1;
                                        *local_alt_indices_counts.entry(alt_idx).or_insert(0) += 1;
                                    }
                                }

                                if chr == b':' {
                                    break;
                                }

                                gt.clear();
                            }

                            if chr == b'.' {
                                // A single missing genotype likely means the call is inaccurate
                                missing.push(idx as u32);
                                continue 'field_loop;
                            }

                            gt.push(chr);
                        }

                        an += local_an_count as u32;
                        for (&ac_idx, &ac_cnt) in local_alt_indices_counts.iter() {
                            ac[ac_idx] += ac_cnt;

                            if local_an_count == ac_cnt {
                                homs[ac_idx].push(idx as u32);
                                break;
                            }
                            hets[ac_idx].push(idx as u32);
                        }
                    }
                    _ => {
                        if field.len() == 1 {
                            if field[0] == b'0' {
                                an += 1;
                            } else if field[2] == b'1' {
                                an += 1;
                                ac[0] += 1;
                                homs[0].push(idx as u32);
                            } else {
                                missing.push(idx as u32);
                            }

                            continue;
                        }

                        if field[0] == b'0' {
                            if field[2] == b'0' {
                                an += 2;
                            } else if field[2] == b'1' {
                                an += 2;
                                ac[0] += 1;
                                hets[0].push(idx as u32);
                            } else {
                                missing.push(idx as u32);
                            }

                            continue;
                        }

                        if field[0] == b'1' {
                            if field[2] == b'0' {
                                an += 2;
                                ac[0] += 1;
                                hets[0].push(idx as u32);
                            } else if field[2] == b'1' {
                                an += 2;
                                ac[0] += 2;
                                homs[0].push(idx as u32);
                            } else {
                                missing.push(idx as u32);
                            }

                            continue;
                        }
                    }
                }
            }
        }
        if n_samples > 0 && an == 0 {
            continue;
        }

        if !missing.is_empty() {
            effective_samples = { n_samples - missing.len() as u32 } as f32;
        } else {
            effective_samples = n_samples as f32;
        }

        match &alleles {
            SiteEnum::None => continue,
            SiteEnum::MonoAllelic(allele) => match allele {
                if n_samples > 0 && ac[0] == 0 {
                    continue;
                }

                write_chrom(&mut buffer, &chrom);
                buffer.push(b'\t');

                VariantEnum::SNP(v) => {
                    buffer.extend_from_slice(v.position);
                    buffer.push(b'\t');
                    buffer.extend_from_slice(SNP);
                    buffer.push(b'\t');
                    buffer.push(v.reference);
                    buffer.push(b'\t');
                    buffer.push(v.alternate);
                    buffer.push(b'\t');
                    buffer.push(TSTV[v.reference as usize][v.alternate as usize]);
                    buffer.push(b'\t');\
                },
                VariantEnum::DEL(v) => {

                

                write_int(&mut buffer, v.position, &mut bytes);
                buffer.push(b'\t');
                buffer.extend_from_slice(DEL);
                buffer.push(b'\t');
                buffer.push(v.reference);
                buffer.push(b'\t');
                write_int(&mut buffer, v.alternate, &mut bytes);
                buffer.push(b'\t');
                buffer.push(NOT_TSTV);
                buffer.push(b'\t');
            }
            VariantEnum::INS(v) => {
                buffer.extend_from_slice(v.position);
                buffer.push(b'\t');
                buffer.extend_from_slice(INS);
                buffer.push(b'\t');
                buffer.push(v.reference);
                buffer.push(b'\t');
                buffer.push(b'+');
                buffer.extend_from_slice(v.alternate);
                buffer.push(b'\t');
                buffer.push(NOT_TSTV);
                buffer.push(b'\t');
            }

            if n_samples > 0 {
                        write_samples(
                            header,
                            &mut buffer,
                            &hets[0],
                            &homs[0],
                            &missing,
                            effective_samples,
                            n_samples,
                            ac[0],
                            an,
                            &mut bytes,
                            &mut f_buf,
                        );
                    } else {
                        write_samples_empty(&mut buffer);
                    }
                    buffer.push(b'\t');
        },
            
        
        SiteEnum::MultiAllelic(variants) => {
                for i in 0..variants.len() {
                    if n_samples > 0 && ac[i] == 0 {
                        continue;
                    }

                    if i > 0 {
                        buffer.push(b'\n');
                    }
                    write_chrom(&mut buffer, &chrom);
                    buffer.push(b'\t');

                    match &variants[i] {
                        VariantEnum::None => {
                            continue;
                        }
                        VariantEnum::SNP(v) => {
                            buffer.extend_from_slice(v.position);
                            buffer.push(b'\t');
                            buffer.extend_from_slice(MULTI);
                            buffer.push(b'\t');
                            buffer.push(v.reference);
                            buffer.push(b'\t');
                            itoa::write(&mut bytes, v.alternate).unwrap();
                            buffer.extend_from_slice(&bytes);
                            bytes.clear();

                            buffer.push(b'\t');
                            buffer.push(NOT_TSTV)
                            buffer.push(b'\t');
                        }
                        AlleleTypes::INS(v) | AlleleTypes::DEL(v) => {
                            itoa::write(&mut bytes, v.position).unwrap();
                            buffer.extend_from_slice(&bytes);
                            bytes.clear();

                            buffer.push(b'\t');

                            buffer.extend_from_slice(SITE_TYPES[*site_type_idx as usize]);
                            buffer.push(b'\t');
                            buffer.push(v.reference);
                            buffer.push(b'\t');
                            buffer.extend_from_slice(&v.alternate);
                            bytes.clear();

                            buffer.push(b'\t');
                            buffer.push(NOT_TSTV);
                            buffer.push(b'\t');
                        }
                        AlleleTypes::MNP(v) => {
                            for mnp_part in v {
                                itoa::write(&mut bytes, mnp_part.position).unwrap();
                                buffer.extend_from_slice(&bytes);
                                bytes.clear();

                                buffer.push(b'\t');

                                buffer.extend_from_slice(SITE_TYPES[*site_type_idx as usize]);
                                buffer.push(b'\t');
                                buffer.push(mnp_part.reference);
                                buffer.push(b'\t');
                                itoa::write(&mut bytes, mnp_part.alternate).unwrap();
                                buffer.extend_from_slice(&bytes);
                                bytes.clear();

                                buffer.push(b'\t');
                                if *site_type_idx == MULTI_IDX {
                                    buffer.push(NOT_TSTV)
                                } else {
                                    buffer.push(
                                        TSTV[mnp_part.reference as usize]
                                            [mnp_part.alternate as usize],
                                    )
                                }
                                buffer.push(b'\t');
                            }
                        }
                    }
                    if n_samples > 0 {
                        write_samples(
                            header,
                            &mut buffer,
                            &hets[i],
                            &homs[i],
                            &missing,
                            effective_samples,
                            n_samples,
                            ac[i],
                            an,
                            &mut bytes,
                            &mut f_buf,
                        );
                    } else {
                        write_samples_empty(&mut buffer);
                    }
                }
                buffer.push(b'\t');
            }
        // vcfPos
        buffer.extend_from_slice(pos);
        buffer.push(b'\n');
    }

    if !buffer.is_empty() {
        io::stdout().write_all(&buffer).unwrap();
    }

    n_count
}

fn main() -> Result<(), io::Error> {
    let (s1, r1) = unbounded();
    let n_cpus = num_cpus::get();

    let stdin = io::stdin();
    let mut stdin_lock = std::io::BufReader::with_capacity(48 * 1024 * 1024, stdin.lock());

    let (head, n_eol_chars) = get_header_and_num_eol_chars(&mut stdin_lock);

    let header: Arc<Vec<Vec<u8>>> = Arc::new(
        head.split(|b| *b == b'\t')
            .map(|sample| sample.to_vec())
            .collect(),
    );

    if header.len() == 9 {
        info!("Found 9 header fields. When genotypes present, we expect 1+ samples after FORMAT (10 fields minimum)")
    }

    // TODO: print header programmatically
    io::stdout().write_all(b"chrom\tpos\ttype\tref\talt\ttrTv\theterozygotes\theterozygosity\thomozygotes\thomozygosity\tmissingGenos\tmissingness\tac\tan\tsampleMaf\tvcfPos\n")?;

    let mut threads = vec![];

    for _i in 0..n_cpus {
        let r = r1.clone();
        let header = Arc::clone(&header);

        threads.push(thread::spawn(move || {
            let mut n_count: usize = 0;

            loop {
                let message: Vec<Vec<u8>> = match r.recv() {
                    Ok(v) => v,
                    Err(_) => break,
                };

                n_count += process_lines(&header, &message);
            }

            n_count
        }));
    }

    let max_lines = 48;
    let mut len;
    let mut lines: Vec<Vec<u8>> = Vec::with_capacity(max_lines);
    let mut buf = Vec::with_capacity(48 * 1024 * 1024);
    let mut n_count = 0;

    loop {
        // https://stackoverflow.com/questions/43028653/rust-file-i-o-is-very-slow-compared-with-c-is-something-wrong
        len = stdin_lock.read_until(b'\n', &mut buf)?;

        if len == 0 {
            if lines.len() > 0 {
                s1.send(lines).unwrap();
            }
            break;
        }

        // TOOD read end of line number of characters from header
        lines.push(buf[..len - n_eol_chars].to_vec());
        buf.clear();

        if lines.len() == max_lines {
            n_count += lines.len();
            s1.send(lines).unwrap();
            lines = Vec::with_capacity(max_lines);
        }
    }
    drop(s1);

    let mut total = 0;
    for thread in threads {
        total += thread.join().unwrap();
    }

    assert_eq!(total, n_count);

    return Ok(());
}
