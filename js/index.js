import("../pkg").then(module => {

const TILE_SIZE = 20; // px
const GRID_COLOR = "#CCCCCC";
const HIDDEN_TILE_COLOR = "#626262";
const VISIBLE_TILE_COLOR = '#FFFFFF';
const FLAGGED_COLOR = "#3e53aa";
const BOMB_COLOR = "#bd2823";
const TEXT_COLOR = "#000000";


document.querySelector("#btn-6-by-6").addEventListener("click", function() { newGame(6, 6, 5); });
document.querySelector("#btn-10-by-10").addEventListener("click", function() { newGame(10, 10, 16); });
document.querySelector("#btn-15-by-15").addEventListener("click", function() { newGame(15, 15, 30); });
document.getElementById("btn-restart").addEventListener("click", function() { restartGame(); });
document.getElementById("btn-menu").addEventListener("click", function () {
    game.clear();
    showMenu();
    document.getElementById("game-buttons").style.visibility = "hidden";
});


let map;


var PIXEL_RATIO = (function () {
    var ctx = document.createElement("canvas").getContext("2d"),
        dpr = window.devicePixelRatio || 1,
        bsr = ctx.webkitBackingStorePixelRatio ||
              ctx.mozBackingStorePixelRatio ||
              ctx.msBackingStorePixelRatio ||
              ctx.oBackingStorePixelRatio ||
              ctx.backingStorePixelRatio || 1;

    return dpr / bsr;
})();

function createHiPPICanvas(w, h) {
    var ratio = PIXEL_RATIO;
    var can = document.createElement("canvas");
    can.width = w * ratio;
    can.height = h * ratio;
    can.style.width = w + "px";
    can.style.height = h + "px";
    can.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
    return can;
}

const game = {
    canvas: null,
    start: function(row, col, num_bombs) {
        if (this.canvas == null) {
            this.row = row;
            this.col = col;
            this.num_bombs = num_bombs;
            this.canvas = document.createElement("canvas");
            var width = (TILE_SIZE + 1) * map.width() + 1;
            var height = (TILE_SIZE + 1) * map.height() + 1;
            this.canvas = createHiPPICanvas(width, height);
            this.ctx = this.canvas.getContext("2d");
            this.drawGrid();
            this.drawTiles();
            this.canvas.addEventListener("click", function (e) {
                revealTile(e);
            });
            this.canvas.oncontextmenu = function () {
                return false;
            };
            this.canvas.addEventListener("contextmenu", function (e) {
                flagTile(e);
            });
            document.body.insertBefore(this.canvas, document.body.childNodes[2]);
        }
    },

    clear: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.remove();
        this.canvas = null;
    },

    drawGrid: function() {
        this.ctx.beginPath();
        this.ctx.strokeStyle = GRID_COLOR;

        // Vertical lines.
        for (let i = 0; i <= map.width(); i++) {
            this.ctx.moveTo(i * (TILE_SIZE + 1) + 1, 0);
            this.ctx.lineTo(i * (TILE_SIZE + 1) + 1, (TILE_SIZE + 1) * map.height() + 1);
        }

        // Horizontal lines.
        for (let j = 0; j <= map.height(); j++) {
            this.ctx.moveTo(0, j * (TILE_SIZE + 1) + 1);
            this.ctx.lineTo((TILE_SIZE + 1) * map.width() + 1, j * (TILE_SIZE + 1) + 1);
        }

        this.ctx.stroke();
    },

    drawTiles: function() {
        const tiles = map.tiles();
        this.ctx.beginPath();

        for (let row = 0; row < map.height(); row++) {
            for (let col = 0; col < map.width(); col++) {
                const idx = getIndex(row, col);
                let num_bombs = tiles[idx].num_bombs;
                let visible = tiles[idx].visible;
                let flagged = tiles[idx].flagged;
                let bomb = tiles[idx].bomb;


                if (!visible && flagged) {
                    this.ctx.fillStyle = FLAGGED_COLOR;
                    this.ctx.fillRect(
                        col * (TILE_SIZE + 1) + 1,
                        row * (TILE_SIZE + 1) + 1,
                        TILE_SIZE,
                        TILE_SIZE
                    );
                } else if (!visible) {
                    this.ctx.fillStyle = HIDDEN_TILE_COLOR;
                    this.ctx.fillRect(
                        col * (TILE_SIZE + 1) + 1,
                        row * (TILE_SIZE + 1) + 1,
                        TILE_SIZE,
                        TILE_SIZE
                    );
                } else if (visible && bomb) {
                    this.ctx.fillStyle = BOMB_COLOR;
                    this.ctx.fillRect(
                        col * (TILE_SIZE + 1) + 1,
                        row * (TILE_SIZE + 1) + 1,
                        TILE_SIZE,
                        TILE_SIZE
                    );
                } else {
                    this.ctx.fillStyle = VISIBLE_TILE_COLOR;
                    this.ctx.fillRect(
                        col * (TILE_SIZE + 1) + 1,
                        row * (TILE_SIZE + 1) + 1,
                        TILE_SIZE,
                        TILE_SIZE
                    );

                    this.ctx.fillStyle = TEXT_COLOR;
                    this.ctx.font = "15px serif";
                    this.ctx.fillText(num_bombs, col * (TILE_SIZE + 1) + TILE_SIZE / 2 - 3, (row + 1) * (TILE_SIZE + 1) - (TILE_SIZE / 2 - 5));
                }
            }
        }
        this.ctx.stroke();
    }
};


function newGame(row, col, num_bombs) {
    map = module.Map.new(row, col, num_bombs);
    game.start(row, col, num_bombs);
    hideMenu();
}


const getIndex = (row, col) => {
    return row * map.width() + col;
};


function getRowCol(event) {
    const boundingRect = game.canvas.getBoundingClientRect();

    const scaleX = game.canvas.width / (boundingRect.width * PIXEL_RATIO);
    const scaleY = game.canvas.height / (boundingRect.height * PIXEL_RATIO);

    const canvasLeft = (event.clientX - boundingRect.left) * scaleX;
    const canvasTop = (event.clientY - boundingRect.top) * scaleY;

    var click = {
        'row': Math.min(Math.floor(canvasTop / (TILE_SIZE + 1)), map.height() - 1),
        'col': Math.min(Math.floor(canvasLeft / (TILE_SIZE + 1)), map.width() - 1)
    }
    return click;
}


function revealTile(event) {
    var pos = getRowCol(event);

    const tiles = map.tiles();
    const idx = getIndex(pos.row, pos.col);
    let flagged = tiles[idx].flagged;
    let bomb = tiles[idx].bomb;
    if (!flagged) {
        map.set_visible(pos.row, pos.col);
        if (bomb) {
            map.reveal_all();
            document.getElementById("info").innerHTML = "You've lost!";
            document.getElementById("game-buttons").style.visibility = "visible";
        }
    }

    game.drawGrid();
    game.drawTiles();
    if (map.check_victory()) {
        document.getElementById("info").innerHTML = "You've won!";
        document.getElementById("game-buttons").style.visibility = "visible";
    }
}

function flagTile(event) {
    var pos = getRowCol(event);
    map.toggle_flag(pos.row, pos.col);

    game.drawGrid();
    game.drawTiles();


    if (map.check_victory()) {
        document.getElementById("info").innerHTML = "You've won!";
        document.getElementById("game-buttons").style.visibility = "visible";
    }

    return false;
}


function hideMenu() {
    document.getElementById("menu").style.display = "none";
    document.getElementById("info").innerHTML = "left click: reveal tile - right click: flag mine";
}

function showMenu() {
    document.getElementById("menu").style.display = "flex";
    document.getElementById("info").innerHTML = "Choose a grid size to start";
}


function restartGame() {
    let row = game.row;
    let col = game.col;
    let num_bombs = game.num_bombs;
    game.clear();
    document.getElementById("game-buttons").style.visibility = "hidden";
    newGame(row, col, num_bombs);
}
});