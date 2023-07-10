// mmap version
// extern crate rmp_serde as rmps;
// extern crate serde;
// #[macro_use]
// extern crate serde_derive;
// extern crate memmap;

// use std::fs::File;
// use std::io;
// use std::error::Error;
// use std::fmt;
// use rmps::Deserializer;
// use serde::Deserialize;
// use memmap::Mmap;

// #[derive(Debug, Deserialize)]
// struct Data {
//     id: i32,
//     name: String,
//     value: f64,
// }

// #[derive(Debug)]
// enum MyError {
//     Io(io::Error),
//     Decode(rmps::decode::Error),
// }

// impl fmt::Display for MyError {
//     fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
//         match *self {
//             MyError::Io(ref err) => write!(f, "IO error: {}", err),
//             MyError::Decode(ref err) => write!(f, "Decode error: {}", err),
//         }
//     }
// }

// impl Error for MyError {
//     fn source(&self) -> Option<&(dyn Error + 'static)> {
//         match *self {
//             MyError::Io(ref err) => Some(err),
//             MyError::Decode(ref err) => Some(err),
//         }
//     }
// }

// impl From<io::Error> for MyError {
//     fn from(err: io::Error) -> MyError {
//         MyError::Io(err)
//     }
// }

// impl From<rmps::decode::Error> for MyError {
//     fn from(err: rmps::decode::Error) -> MyError {
//         MyError::Decode(err)
//     }
// }

// fn main() -> Result<(), MyError> {
//     // Open the file in read-only mode.
//     let file = File::open("data.msgpack")?;

//     // Create a memory-mapped file.
//     let mmap = unsafe { Mmap::map(&file)? };

//     // Create a deserializer.
//     let mut de = Deserializer::new(&mmap[..]);

//     // Deserialize the data.
//     let data: Data = Deserialize::deserialize(&mut de)?;

//     // Print the data.
//     println!("{:?}", data);

//     Ok(())
// }

// extern crate rmp_serde as rmps;
// extern crate serde;
// #[macro_use]
// extern crate serde_derive;

// use std::env;
// use std::fs::File;
// use std::io::{self, Read};
// use rmps::Deserializer;
// use serde::Deserialize;

// #[derive(Debug, Deserialize)]
// struct Data {
//     id: i32,
//     name: String,
//     value: f64,
// }

// fn main() -> Result<(), Box<dyn std::error::Error>> {
//     // If arguments were passed, read from the file
//     // Otherwise, read from stdin
//     let mut reader: Box<dyn Read> = match env::args().nth(1) {
//         Some(path) => Box::new(File::open(path)?),
//         None => Box::new(io::stdin()),
//     };

//     // Create a buffer to store the data
//     let mut buf = Vec::new();

//     // Read the contents into the buffer
//     reader.read_to_end(&mut buf)?;

//     // Create a deserializer
//     let mut de = Deserializer::new(&buf[..]);

//     // Deserialize the data
//     let data: Data = Deserialize::deserialize(&mut de)?;

//     // Print the data
//     println!("{:?}", data);

//     Ok(())
// }

// extern crate rmp_serde as rmps;
// extern crate serde;
// #[macro_use]
// extern crate serde_derive;

// use std::env;
// use std::fs::File;
// use std::io::{self, Read};
// use rmps::Deserializer;
// use serde::Deserialize;

// #[derive(Debug, Deserialize)]
// struct Data {
//     id: i32,
//     name: String,
//     value: f64,
// }

// fn main() -> Result<(), Box<dyn std::error::Error>> {
//     // If arguments were passed, read from the file
//     // Otherwise, read from stdin
//     let mut reader: Box<dyn Read> = match env::args().nth(1) {
//         Some(path) => Box::new(File::open(path)?),
//         None => Box::new(io::stdin()),
//     };

//     // Create a buffer to store the data
//     let mut buf = Vec::new();

//     // Read the contents into the buffer
//     reader.read_to_end(&mut buf)?;

//     // Create a deserializer
//     let mut de = Deserializer::new(&buf[..]);

//     // Deserialize the data in a loop
//     while let Ok(data) = Data::deserialize(&mut de) {
//         // Print the data
//         println!("{:?}", data);
//     }

//     Ok(())
// }

extern crate rmp_serde as rmps;
extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate serde_json;

use std::env;
use std::fs::File;
use std::io::{self, Read};
use rmps::Deserializer;
use serde::Deserialize;
use serde_json::Value;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // If arguments were passed, read from the file
    // Otherwise, read from stdin
    let mut reader: Box<dyn Read> = match env::args().nth(1) {
        Some(path) => Box::new(File::open(path)?),
        None => Box::new(io::stdin()),
    };

    // Create a buffer to store the data
    let mut buf = Vec::new();

    // Read the contents into the buffer
    reader.read_to_end(&mut buf)?;

    // Create a deserializer
    let mut de = Deserializer::new(&buf[..]);

    // Deserialize the data
    let data: Vec<Vec<Value>> = Deserialize::deserialize(&mut de)?;

    // Print the data
    for row in &data {
        for field in row {
            println!("{:?}", field);
        }
        println!();
    }

    Ok(())
}