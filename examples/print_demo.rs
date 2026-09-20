//! Print a CSON file back out — `cargo run --example print_demo -- file.cson`
use cson::CsonParser;

fn main() {
    let path = std::env::args().nth(1).expect("usage: print_demo <file.cson>");
    let src = std::fs::read_to_string(&path).expect("read");
    let doc = CsonParser::new(&src).parse().expect("parse");
    print!("{}", doc.print());
}
