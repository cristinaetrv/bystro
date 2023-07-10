#!/usr/bin/perl
use strict;
use warnings;
use Data::MessagePack;

my $mp = Data::MessagePack->new->utf8;

# Array of arrays with mixed data types
my $data = [
    [ undef, "scalar", [ "nested", "array" ], [["2D array"], ["another row"]]],
    [ "another", "row", [ "another", "nested", "array" ], [["2D array 2"], ["another row 2"]]],
    [ "and", "another", [ "and", "another", "nested", "array" ], [[["3D array"]], [["another row in 3D"]]]],
];

my $packed = $mp->pack($data);

# Write to stdout
binmode STDOUT;
print $packed;