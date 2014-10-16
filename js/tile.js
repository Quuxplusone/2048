
function Tile(position, type, value) {
  this.x                = position ? position.x : null;
  this.y                = position ? position.y : null;
  this.type             = type;
  this.value            = value;

  this.score            = value;  // by default

  this.accumulatedScore = 0;    // Tracks score to lose when square-rooting this tile
  this.previousPosition = null;
  this.mergedFrom       = null; // Tracks tiles that merged together
}

Tile.prototype.savePosition = function () {
  this.previousPosition = { x: this.x, y: this.y };
};

Tile.prototype.updatePosition = function (position) {
  this.x = position.x;
  this.y = position.y;
};

Tile.prototype.serialize = function () {
  return {
    position: {
      x: this.x,
      y: this.y
    },
    type: this.type,
    value: this.value
  };
};
