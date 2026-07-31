import Phaser from 'phaser'
import { ASSET_MANIFEST } from './assets'

export const STAGE_WIDTH = 1000
export const STAGE_HEIGHT = 1250

class PortraitScene extends Phaser.Scene {
  preload() {
    this.load.image('princess-base', ASSET_MANIFEST.princessBase)
  }

  create() {
    this.add.image(STAGE_WIDTH / 2, STAGE_HEIGHT / 2, 'princess-base')
      .setDisplaySize(STAGE_WIDTH, STAGE_HEIGHT)
  }
}

export const createPortraitGame = (parent: string) => new Phaser.Game({
  type: Phaser.CANVAS,
  parent,
  width: STAGE_WIDTH,
  height: STAGE_HEIGHT,
  transparent: true,
  render: { antialias: true, roundPixels: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: PortraitScene,
})
