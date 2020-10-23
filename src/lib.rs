use::std::collections::HashSet;
use rand::seq::SliceRandom;
use std::error::Error;
use std::fmt;
use wasm_bindgen::prelude::*;

#[macro_use]
extern crate serde_derive;

#[wasm_bindgen]
#[derive(Debug, Copy, Clone, Serialize, Deserialize)]
pub struct Tile {
    bomb: bool,
    flagged: bool,
    visible: bool,
    num_bombs: i32,
}

impl Tile {
    /// Default constructor
    fn new() -> Tile {
        Tile {
            bomb: false,
            flagged: false,
            visible: false,
            num_bombs: 0,
        }
    }

    /// Toggle the flagged tag of the tile
    fn toggle_flagged(&mut self) {
        self.flagged = !self.flagged
    }

    /// Reveal the tile
    fn set_visible(&mut self) {
        self.visible = true
    }
}


#[derive(Debug)]
pub enum MapError {
    OutOfBounds
}

impl Error for MapError {}

impl fmt::Display for MapError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Map error")
    }
}


#[wasm_bindgen]
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Map {
    width: u32,
    height: u32,
    tiles: Vec<Tile>
}

// These methods are exposed to Javascript
#[wasm_bindgen]
impl Map {
    /// Implement a map
    ///
    /// # Arguments
    ///
    /// * `width` - width of the map
    /// * `height` - height of the map
    /// * `num_bombs` - number of bombs present on the map
    pub fn new(width: u32, height: u32, num_bombs: u32) -> Map {
        let mut tiles: Vec<Tile> = Vec::new();
        let num_entries = (width * height) as usize;

        for _ in 0..num_entries {
            tiles.push(Tile::new());
        }

        // Insert randomly placed bombs
        let mut rng = &mut rand::thread_rng();
        let values: Vec<_> = (0..num_entries).collect();
        let idxs: Vec<_> = values.choose_multiple(&mut rng, num_bombs as usize).collect();
        for i in idxs {
            tiles[*i].bomb = true;
        }

        let mut map = Map {
            width,
            height,
            tiles,
        };

        map.set_bombs_numbers();
        map
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }


    pub fn tiles(&self) -> JsValue {
        JsValue::from_serde(&self.tiles).unwrap()
    }


    /// Set the visibility of the tile at (row, col) to true. Additionally, if no bomb is present
    /// in the neighborhood, reveal all tiles in the neighborhood.
    pub fn set_visible(&mut self, row: u32, col: u32) {
        let tile = self.get_mut_tile(row, col);
        match tile {
            Some(t) => {
                t.set_visible();
                if t.num_bombs == 0 {
                    let mut processed: HashSet<usize> = HashSet::new();
                    let idx: usize = self.get_index(row, col).unwrap();
                    self.recursive_reveal(idx, &mut processed);
                }
            },
            None => (),
        }
    }


    pub fn toggle_flag(&mut self, row: u32, col: u32) {
        let tile = self.get_mut_tile(row, col);
        match tile {
            Some(t) => t.toggle_flagged(),
            None => (),
        }
    }

    /// Set all tiles to visible
    pub fn reveal_all(&mut self) {
        for row in 0..self.height {
            for col in 0..self.width {
                self.get_mut_tile(row, col).unwrap().visible = true;
            }
        }
    }

    /// Check if the game is won
    pub fn check_victory(&self) -> bool {
        for row in 0..self.height {
            for col in 0..self.width {
                let tile = self.get_tile(row, col).unwrap();
                if !tile.visible && !tile.bomb || tile.flagged && !tile.bomb || tile.visible && tile.bomb || !tile.flagged && tile.bomb {
                    return false;
                }
            }
        }
        true
    }

}


// These methods are not exposed to Javascript
impl Map {
    /// Return a mutable reference to a tile in the map
    ///
    /// # Arguments
    ///
    /// * `row` - row number of the tile
    /// * `col` - column number of the tile
    fn get_mut_tile(&mut self, row: u32, col: u32) -> Option<&mut Tile> {
        if row >= self.height || col >= self.width {
            None
        } else {
            match self.get_index(row, col) {
                Ok(idx) => Some(&mut self.tiles[idx]),
                Err(_) => None,
            }
        }
    }


    /// Return a reference to a tile in the map
    ///
    /// # Arguments
    ///
    /// * `row` - row number of the tile
    /// * `col` - column number of the tile
    fn get_tile(&self, row: u32, col: u32) -> Option<&Tile> {
        if row >= self.height || col >= self.width {
            None
        } else {
            match self.get_index(row, col) {
                Ok(idx) => Some(&self.tiles[idx]),
                Err(_) => None,
            }
        }
    }


    /// Compute the index in the map corresponding to the location of a tile
    ///
    /// # Arguments
    ///
    /// * `row` - row number of the tile
    /// * `col` - column number of the tile
    fn get_index(&self, row: u32, col:u32) -> Result<usize, MapError> {
        if row < self.height && col < self.width {
            Ok((row  * self.width + col) as usize)
        } else {
            Err(MapError::OutOfBounds)
        }
    }


    /// Compute the row and column corresponding to a given index
    fn get_coordinates(&self, idx: usize) -> (u32, u32) {
        ((idx as u32 / self.width), idx as u32 % self.width)
    }


    /// Compute the indices of the tiles surrounding a given tile
    ///
    /// # Arguments
    ///
    /// * `row` - row number of the tile
    /// * `col` - column number of the tile
    fn get_neighbors_idxs(&self, row: u32, col:u32) -> Option<Vec<usize>> {
        let mut neighbors_idxs: Vec<usize> = Vec::new();
        for i in [-1, 0, 1].iter() {
            for j in [-1, 0, 1].iter() {
                if *i != 0 || *j != 0 {
                    let neighbor_row = row as i32 + i;
                    let neighbor_col = col as i32 + j;
                    if neighbor_row >= 0 && neighbor_row < self.height as i32 && neighbor_col >= 0 && neighbor_col < self.width as i32 {
                        match self.get_index(neighbor_row as u32, neighbor_col as u32) {
                            Ok(idx) => neighbors_idxs.push(idx),
                            Err(_) => (),
                        }
                    }
                }
            }
        }
        Some(neighbors_idxs)
    }

    /// Count and set the number of bombs in the surrounding of each tile
    fn set_bombs_numbers(&mut self) {
        for row in 0..self.height {
            for col in 0..self.width {
                if !self.get_tile(row, col).unwrap().bomb {
                    let neighbors_idxs = self.get_neighbors_idxs(row, col).unwrap();
                    for idx in neighbors_idxs {
                        if self.tiles[idx].bomb {
                            self.get_mut_tile(row, col).unwrap().num_bombs += 1;
                        }
                    }
                } else {
                    self.get_mut_tile(row, col).unwrap().num_bombs = -1;
                }
            }
        }
    }


    /// Recursively reveal all tile with no bomb in its neighborhood.
    fn recursive_reveal(&mut self, idx: usize, processed: &mut HashSet<usize>) {
        if !processed.contains(&idx) {
            if self.tiles[idx].num_bombs == 0 {
                let (row, col) = self.get_coordinates(idx);
                let idxs = self.get_neighbors_idxs(row, col).unwrap();
                self.tiles[idx].set_visible();
                processed.insert(idx);
                for neighbor in idxs {
                    self.recursive_reveal(neighbor, processed);
                }
            } else if self.tiles[idx].flagged {
                processed.insert(idx);
            } else {
                self.tiles[idx].set_visible();
                processed.insert(idx);
            }
        }
    }
}