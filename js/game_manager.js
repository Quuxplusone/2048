function GameManager(version, InputManager, Actuator, StorageManager) {
  this.version = version;
  this.size           = 4; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager(version);
  this.actuator       = new Actuator;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 32768)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState && this.version !== 'home') {
    mixpanel.track("Load previous state", { score: previousState.score, hour: (new Date()).getHours() });
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
    if (this.version === 'heavy') {
      this.heavyCountdown = previousState.heavyCountdown;
    }
  } else {
    mixpanel.track("New game", { score: 0, hour: (new Date()).getHours() });
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;
    if (this.version === 'heavy') {
      this.heavyCountdown = 10;
    }

    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  if (this.version === 'home') {
    this.grid.insertTile(new Tile({x: 1, y: 1}, 'cursor', 0, false));
    this.grid.insertTile(new Tile({x: 2, y: 3}, 'root', 2, false));
    this.grid.insertTile(new Tile({x: 3, y: 3}, 'log', 0, false));
    this.grid.insertTile(new Tile({x: 3, y: 1}, 'number', 512, true));
    this.grid.insertTile(new Tile({x: 1, y: 2}, 'number', 2, false));
  } else {
    for (var i = 0; i < 2; i++) {
      this.addRandomTile(true);
    }
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function (initial) {
  if (this.grid.cellsAvailable()) {
    var type;
    if (initial) {
      type = 'number';
    } else if (this.version === 'log') {
      type = (Math.random() < 0.8) ? 'number' :
             (Math.random() < 0.3) ? 'multiply' :
             (Math.random() < 0.5) ? 'log' : 'root';
    } else if (this.version === 'sqrt') {
      type = (Math.random() < 0.8) ? 'number' :
             (Math.random() < 0.4) ? 'multiply' :
             'root';
    } else {
      type = 'number';
    }
    var value = (type === 'log') ? 0 :
                (type === 'root') ? 2 :
                (Math.random() < 0.9) ? 2 : 4;
    var is_heavy = false;
    if (this.version === 'heavy') {
      if (this.heavyCountdown === 0 && Math.random() < 0.1) {
        value = 16;
        while (value < 512 && Math.random() < 0.5) value *= 2;
        is_heavy = true;
      }
    }

    var tile = new Tile(this.grid.randomAvailableCell(), type, value, is_heavy);
    this.grid.insertTile(tile);
    mixpanel.track('Add tile', { type: type, value: value, is_heavy: is_heavy, hour: (new Date()).getHours() });
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.isGameTerminated()
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying,
    heavyCountdown: this.heavyCountdown,
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

GameManager.prototype.isPowerOf2 = function (x) {
  if (x <= 0) return false;
  var s = this.log2(x);
  return (x === Math.pow(2, s));
};

GameManager.prototype.isNthRootable = function (n, x) {
  if (x < 0) return false;
  if (x === 0) return true;
  if (this.isPowerOf2(x)) {
    var log2_x = this.log2(x);
    return log2_x % n == 0;
  } else {
    var s = Math.pow(x, 1/n);
    return (s === Math.round(s));
  }
};

GameManager.prototype.nthRoot = function (n, x) {
  if (x === 0) return 0;
  return Math.round(Math.pow(x, 1/n));
};

GameManager.prototype.isLoggable = function (x) {
  if (x <= 1) return true;
  var log2_x = this.log2(x);
  // The tile is loggable only if log2(x) is itself a power of 2.
  var log2_log2_x = this.log2(log2_x);
  return (log2_x === Math.pow(2, log2_log2_x));
};

GameManager.prototype.log2 = function (x) {
  return Math.round(Math.log(x) / Math.log(2));
};

GameManager.prototype.synthesizedAccumulatedScore = function (t) {
  // Suppose the new value is 2^n. Then building that value out of 4's would
  // earn us 2^n + 2*(2^(n-1)) + 4*(2^(n-2)) + ... + (2^(n-3))*(2^3) points.
  var n = (t.value <= 1) ? 0 : this.log2(t.value);
  var newAccumulatedScore = Math.max(0, (1 << n) * (n-2));
  return Math.min(t.accumulatedScore, newAccumulatedScore);
};

GameManager.prototype.resultOfMerging = function (from, to) {
  var t = null;
  if (to.type === 'multiply') {
    if (from.type === 'cursor') {
      t = new Tile(null, 'number', 2048, false);
    } else if (from.type === 'multiply' && from.value === to.value) {
      t = new Tile(null, 'multiply', from.value * to.value, false);
      t.accumulatedScore = (from.accumulatedScore + to.accumulatedScore);
    }
  } else if (to.type === 'log') {
    if (from.type === 'cursor') {
      t = new Tile(null, 'number', 2048, false);
    }
  } else if (to.type === 'root') {
    if (from.type === 'cursor') {
      t = new Tile(null, 'number', 2048, false);
    } else if (from.type === 'root' && from.value === to.value) {
      t = new Tile(null, 'root', from.value + to.value, false);
      t.accumulatedScore = (from.accumulatedScore + to.accumulatedScore);
    }
  } else if (to.type === 'number') {
    if (from.type === 'cursor') {
      t = new Tile(null, 'number', 2048, false);
    } else if (from.type === 'multiply') {
      t = new Tile(null, 'number', from.value * to.value, to.is_heavy);
      t.accumulatedScore = (from.accumulatedScore + to.accumulatedScore);
    } else if (from.type === 'root' && this.isNthRootable(from.value, to.value)) {
      t = new Tile(null, 'number', this.nthRoot(from.value, to.value), to.is_heavy);
      t.accumulatedScore = (from.accumulatedScore + to.accumulatedScore);
      t.score = this.synthesizedAccumulatedScore(t) - t.accumulatedScore;
    } else if (from.type === 'log' && this.isLoggable(to.value)) {
      var newAccumulatedScore;
      if (to.value === 0) {
        var value = 16;
        while (value < 512 && Math.random() < 0.5) value *= 2;
        t = new Tile(null, 'number', value, true);
        newAccumulatedScore = 0;
      } else {
        t = new Tile(null, 'number', this.log2(to.value), to.is_heavy);
        newAccumulatedScore = this.synthesizedAccumulatedScore(t);
      }
      t.accumulatedScore = (from.accumulatedScore + to.accumulatedScore);
      t.score = newAccumulatedScore - t.accumulatedScore;
      t.accumulatedScore = newAccumulatedScore;
    } else if (from.type === 'number' && from.value === to.value) {
      t = new Tile(null, 'number', from.value + to.value, false);
      t.accumulatedScore = (from.accumulatedScore + to.accumulatedScore);
    }
  }
  if (t !== null) {
    t.accumulatedScore += t.score;
  }
  return t;
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector      = this.getVector(direction);
  var traversals  = this.buildTraversals(vector);
  var moved       = false;
  var destination = null;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile && !tile.is_heavy) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        var merged =
          !next ? null :
          next.mergedFrom ? null : // Only one merger per row traversal
          self.resultOfMerging(tile, next);

        if (merged) {
          merged.updatePosition(positions.next);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.score;

          var bestScore = self.storageManager.getBestScore();
          mixpanel.track("Merge tile", { score: self.score, bestScore: bestScore, type: merged.type, value: merged.value, scoreDelta: merged.score, hour: (new Date()).getHours() });

          if (!self.won) {
            var winning_value = 2048;
            if (self.version === 'log' || self.version === 'sqrt' || self.version === 'home') {
              winning_value = 32768;
            }
            if (merged.type === 'number' && merged.value >= winning_value) {
              self.won = true;
              mixpanel.track("Win the game", { score: self.score, bestScore: bestScore, hour: (new Date()).getHours() });
            }
          }

          if (self.version === 'home') {
            if (tile.type === 'cursor') {
              destination = (next.type === 'log') ? 'log.html' :
                            (next.type === 'root') ? 'sqrt.html' :
                            (next.is_heavy) ? 'heavy.html' :
                            'original.html';
            }
          }
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    if (this.version === 'heavy') {
      var someoneIsHeavy = false;
      this.grid.eachCell(function (x, y, tile) {
        someoneIsHeavy = (someoneIsHeavy || (tile && tile.is_heavy));
      });

      if (someoneIsHeavy) {
        this.heavyCountdown = 10;
      } else if (this.heavyCountdown > 0) {
        this.heavyCountdown -= 1;
      }
    }

    if (this.version !== 'home') {
      this.addRandomTile();
    }

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }
  if (destination) {
    window.setTimeout(function () {
      window.location.href = destination;
    }, 500);
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile && !tile.is_heavy) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && self.resultOfMerging(tile, other)) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
