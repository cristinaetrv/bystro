#!/usr/bin/perl
use strict;
use warnings;

use Data::MessagePack;
use Sys::Mmap;

# Data to be serialized
my $data = {
    id    => 1,
    name  => "John Doe",
    value => 42.0
};

# Serialize the data
my $mp = Data::MessagePack->new->utf8;
my $packed_data = $mp->pack($data);

# Size of data
my $size = length($packed_data);

# File to be mapped
my $file = 'data.msgpack';

# Open the file and set the size
open my $fh, '>', $file or die $!;
truncate $fh, $size or die $!;
close $fh;

# Map the file into memory
open $fh, '+<', $file or die $!;
mmap my $file_contents, $size, PROT_READ|PROT_WRITE, MAP_SHARED, $fh or die $!;
close $fh;

# Write the packed data into the memory-mapped file
substr($file_contents, 0, $size) = $packed_data;

# Unmap the memory
munmap $file_contents;

print "Data written to $file\n";