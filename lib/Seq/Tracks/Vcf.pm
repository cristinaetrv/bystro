use 5.10.0;
use strict;
use warnings;

package Seq::Tracks::Vcf;

our $VERSION = '0.001';

# ABSTRACT: The getter for any type == vcf track
# VERSION

use Mouse 2;
use namespace::autoclean;
use DDP;
extends 'Seq::Tracks::Get';

__PACKAGE__->meta->make_immutable;

sub BUILD {
  my $self = shift;
  $self->{_altIdx} = $self->getFieldDbName('alt');

  if(!defined $self->{_altIdx}) {
    die "Couldn't find 'alt' feature, required for Vcf tracks";
  }
}

sub get {
  # Avoid assignments, save overhead
  #my ($self, $href, $chr, $refBase, $allele, $outAccum, $alleleNumber) = @_
  # $_[0] == $self
  # $_[1] == <ArrayRef> $href : the database data, with each top-level index corresponding to a track
  # $_[2] == <String> $chr  : the chromosome
  # $_[3] == <String> $refBase : ACTG
  # $_[4] == <String> $allele  : the allele (ACTG or -N / +ACTG)
  # $_[5] == <Int> $alleleIdx  : if this is a single-line multiallelic, the allele index
  # $_[6] == <Int> $positionIdx : the position in the indel, if any
  # $_[7] == <ArrayRef> $outAccum : a reference to the output, which we mutate

  # Unlike other tracks, for Vcf, we only return exact matches
  # So tiling across the entire deleted region isn't appropriate
  # Could result in false positives during search
  if($_[6] > 0) {
    return $_[7];
  }

  my $data = $_[1]->[$_[0]->{_dbName}];

  if(!defined $data) {
    return $_[7];
  }

  my $alt = $data->[$_[0]->{_altIdx}];

  # To save CPU time, only enter for loop when necessary
  # Almost all VCF sites (~99%) will not be multiallelic, and so the alt stored
  # in db will be a scalar
  # Handle this as a special, fast path
  if(!ref $alt) {
    if($alt eq $_[4]) {
      # Alt is a scalar, which means there were no overlapping database values
      # at this pposiiton, and all fields represent a single value
      for my $idx (@{$_[0]->{_fieldIdxRange}}) {
        #$outAccum->[$idx][$alleleIdx][$positionIdx] = $href->[$self->{_dbName}][$self->{_fieldDbNames}[$idx]] }
        $_[7]->[$idx][$_[5]][$_[6]] = $data->[$_[0]->{_fieldDbNames}[$idx]];
      }
    }

    return $_[7];
  }

 
  # If $alt is a reference (expect array: if not, this is a programmatic error 
  # which we allow to crash the program)
  # then find the matching alt if any, record its index in the database array,
  # and look up all YAML-defined fields at this index in the same db data arrayref
  # All fields are required to have the same depth, during building
  my $dataIdx = 0;

  for my $alt (@$alt) {
    if($alt eq $_[4]) {
      for my $fieldIdx (@{$_[0]->{_fieldIdxRange}}) {
        #$outAccum->[$fieldIdx][$alleleIdx][$positionIdx] = $data->[$self->{_fieldDbNames}[$dataIdx]] }
        $_[7]->[$fieldIdx][$_[5]][$_[6]] = $data->[$_[0]->{_fieldDbNames}[$fieldIdx]][$dataIdx];
      }

      #return $outAccum;
      return $_[7];
    }

    $dataIdx++;
  }

  # If we got to this point, we found nothing.
  # Note that unlike other tracks that tile across indels, we return a single
  # undef, rather than per-alt or per-position in indel
  return $_[7];
}

__PACKAGE__->meta->make_immutable;

1;
