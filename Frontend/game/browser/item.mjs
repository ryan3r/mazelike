/* global PIXI */
import ItemCommon from '../common/item';

/** @module Item */

export default class Item extends ItemCommon {
  createSprite() {
    this.sprite = new PIXI.sprite(PIXI.loader.resources.player.textures[this.spriteName]);
    if(this.isOnFloor) {
      this.srpite.position.set(this.x, this.y);
    }
    this.sprite.width = this.sprite.height = this.spriteSize;
    this.floor.itemSprites.addChild(this.sprite);
  }

  /**
   * Update the sprite's position for all items on the floor
   * @param viewX
   * @param viewY
   */
  update(viewX, viewY) {
    this.sprite.position.set(this.x - viewX, this.y - viewY);
  }

  handleState(state) {
    Object.assign(this, state);
  }

  /**
   * Remove an item from the itemSprites
   */
  remove() {
    this.floor.itemSprites.removeChild(this.sprite);
  }

  _positionsEqual(pos) {
    return this.x === pos.x && this.y === pos.y;
  }
}