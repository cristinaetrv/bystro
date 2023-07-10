#!/usr/bin/perl
use strict;
use warnings;
use Data::MessagePack;

my $mp = Data::MessagePack->new->utf8;
my $data = {
    id => 123,
    name => "John Doe",
    value => 456.78,
};

my $packed = $mp->pack($data);

# Write to stdout
binmode STDOUT;
print $packed;

$data = {
    id => 1234,
    name => "John Doe2",
    value => 456.78,
};

$packed = $mp->pack($data);
print $packed;