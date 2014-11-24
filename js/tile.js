
function Tile(position, value) {
  this.x                = position ? position.x : null;
  this.y                = position ? position.y : null;
  this.value            = value;
  this.is_heavy         = false;

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
    value: this.value,
    is_heavy: this.is_heavy
  };
};
