function HTMLActuator() {
  this.tileContainer    = document.querySelector(".tile-container");
  this.scoreContainer   = document.querySelector(".score-container");
  this.bestContainer    = document.querySelector(".best-container");
  this.messageContainer = document.querySelector(".game-message");

  this.score = 0;
}

HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;

  window.requestAnimationFrame(function () {
    self.clearContainer(self.tileContainer);

    grid.cells.forEach(function (column) {
      column.forEach(function (cell) {
        if (cell) {
          self.addTile(cell);
        }
      });
    });

    self.updateScore(metadata.score);
    self.updateBestScore(metadata.bestScore);

    if (metadata.terminated) {
      if (metadata.over) {
        self.message(false); // You lose
      } else if (metadata.won) {
        self.message(true); // You win!
      }
    }

  });
};

// Continues the game (both restart and keep playing)
HTMLActuator.prototype.continueGame = function () {
  this.clearMessage();
};

HTMLActuator.prototype.clearContainer = function (container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
};

HTMLActuator.prototype.addTile = function (tile) {
  var self = this;

  var wrapper   = document.createElement("div");
  var inner     = document.createElement("div");
  var position  = tile.previousPosition || { x: tile.x, y: tile.y };
  var positionClass = this.positionClass(position);

  var appearanceClasses = this.appearanceClasses(tile);

  if (tile.is_heavy) {
    appearanceClasses = appearanceClasses.concat(["tile-heavy"]);
  }
  if (tile.type === 'cursor') {
    appearanceClasses = appearanceClasses.concat(["tile-cursor"]);
  }

  // We can't use classlist because it somehow glitches when replacing classes
  var classes = ["tile", positionClass].concat(appearanceClasses);

  this.applyClasses(wrapper, classes);

  var D = function(x) {
    if (x <= 99999) return x;
    var log2_x = Math.round(Math.log(x) / Math.log(2));
    return '2<sup>' + log2_x + '</sup>';
  }

  inner.classList.add("tile-inner");
  inner.innerHTML =
      (tile.type === 'number') ? D(tile.value) :
      (tile.type === 'root') ? (tile.value === 2 ? '√' : '<sup>'+D(tile.value)+'</sup>√') :
      (tile.type === 'log') ? ('log') :
      (tile.type === 'multiply') ? ('×' + D(tile.value)) :
      (tile.type === 'cursor') ? ('') :
      'X';

  if (tile.previousPosition) {
    // Make sure that the tile gets rendered in the previous position first
    window.requestAnimationFrame(function () {
      classes[1] = self.positionClass({ x: tile.x, y: tile.y });
      self.applyClasses(wrapper, classes); // Update the position
    });
  } else if (tile.mergedFrom) {
    classes.push("tile-merged");
    this.applyClasses(wrapper, classes);

    // Render the tiles that merged
    tile.mergedFrom.forEach(function (merged) {
      self.addTile(merged);
    });
  } else {
    classes.push("tile-new");
    this.applyClasses(wrapper, classes);
  }

  // Add the inner part of the tile to the wrapper
  wrapper.appendChild(inner);

  // Put the tile on the board
  this.tileContainer.appendChild(wrapper);
};

HTMLActuator.prototype.applyClasses = function (element, classes) {
  element.setAttribute("class", classes.join(" "));
};

HTMLActuator.prototype.normalizePosition = function (position) {
  return { x: position.x + 1, y: position.y + 1 };
};

HTMLActuator.prototype.positionClass = function (position) {
  position = this.normalizePosition(position);
  return "tile-position-" + position.x + "-" + position.y;
};

HTMLActuator.prototype.valueClass = function (tile) {
  if (tile.value > 2048) {
    return "tile-super";
  } else if (tile.value == 2048) {
    return "tile-2048";
  } else if (tile.value >= 1000) {
    // The only such tile in this version is 1024, but the default styling
    // doesn't work for four-digit numbers, so give all four-digit numbers
    // this style in order to help people writing their own mods.
    return "tile-1024";
  } else {
    return "tile-" + tile.value;
  }
};

HTMLActuator.prototype.digitsIn = function (value) {
  return Math.ceil(Math.log(value+1) / Math.log(10));
};

HTMLActuator.prototype.digitsClass = function (value, plus) {
  if (value <= 99999) {
    return "tile-" + (plus + this.digitsIn(value)) + "-digits";
  } else {
    // Such a large value will be displayed as 2<sup>N</sup>.
    // This recursive formula isn't correct for numbers above 2^9999, but that's probably okay.
    var log2_value = Math.round(Math.log(value) / Math.log(2));
    return this.digitsClass(log2_value, plus+1);
  }
};

HTMLActuator.prototype.appearanceClasses = function (tile) {
  if (tile.type === 'number') {
    return [this.valueClass(tile), this.digitsClass(tile.value, 0)];
  } else if (tile.type === 'root') {
    return [this.digitsClass(tile.value, 1)];
  } else if (tile.type === 'log') {
    return [this.digitsClass(tile.value, 1)];
  } else if (tile.type === 'multiply') {
    return [this.digitsClass(tile.value, 1)];
  } else {
    return [];
  }
};

HTMLActuator.prototype.updateScore = function (score) {
  this.clearContainer(this.scoreContainer);

  var difference = score - this.score;
  this.score = score;

  this.scoreContainer.textContent = this.score;

  if (difference !== 0) {
    var addition = document.createElement("div");
    addition.classList.add("score-addition");
    addition.textContent = ((difference > 0) ? "+" : "−") + Math.abs(difference);

    this.scoreContainer.appendChild(addition);
  }
};

HTMLActuator.prototype.updateBestScore = function (bestScore) {
  this.bestContainer.textContent = bestScore;
};

HTMLActuator.prototype.message = function (won) {
  var type    = won ? "game-won" : "game-over";
  var message = won ? "You win!" : "Game over!";

  this.messageContainer.classList.add(type);
  this.messageContainer.getElementsByTagName("p")[0].textContent = message;
};

HTMLActuator.prototype.clearMessage = function () {
  // IE only takes one value to remove at a time.
  this.messageContainer.classList.remove("game-won");
  this.messageContainer.classList.remove("game-over");
};
