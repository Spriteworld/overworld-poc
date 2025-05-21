import { getValue } from '@Utilities';
import Anchor from 'phaser3-rex-plugins/plugins/anchor.js';

var textBox = function (scene, x, y, config) {
  var wrapWidth = getValue(config, 'wrapWidth', 0);
  var fixedWidth = getValue(config, 'fixedWidth', 0);
  var fixedHeight = getValue(config, 'fixedHeight', 0);
  var textBox = scene.rexUI.add.textBox({
      x: x,
      y: y,

      background: scene.rexUI.add
        .roundRectangle(0, 0, 2, 2, 20, 0x000000)
        .setStrokeStyle(2, 0xffffff),
      icon: null,

      // text: getBuiltInText(scene, wrapWidth, fixedWidth, fixedHeight),
      text: getBBcodeText(scene, wrapWidth, fixedWidth, fixedHeight),

      action: scene.add.image(0, 0, 'nextPage').setTint(0x7b5e57).setVisible(false),

      space: {
        left: 5,
        right: 10,
        top: 20,
        bottom: 10,
        icon: 10,
        text: 10,
      }
    })
    .setOrigin(0)
    .layout()
  ;

  new Anchor(textBox, {
    bottom: '100%-10%',
    centerX: 'center'
  });

  textBox
    .setInteractive()
    .on('complete', () => {
      scene.input.keyboard.once('keydown-Z', () => {
        setTimeout(() => {
          scene.game.events.emit('textbox-disable');
        }, 500);
      });
    }, scene)
  ;

  scene.input.keyboard.on('keydown-Z', () => {
    if (textBox.isTyping) {
      textBox.stop(true);
    } else if (!textBox.isLastPage) {
      textBox.typeNextPage();
    }
  });

  return textBox;
}

var getBuiltInText = function (scene, wrapWidth, fixedWidth, fixedHeight) {
  return scene.add.text(0, 0, '', {
    fontSize: '20px',
    wordWrap: {
      width: wrapWidth
    },
    maxLines: 2
  })
  .setFixedSize(fixedWidth, fixedHeight);
}

var getBBcodeText = function (scene, wrapWidth, fixedWidth, fixedHeight) {
  return scene.rexUI.add.BBCodeText(0, 0, '', {
    fixedWidth: fixedWidth,
    fixedHeight: fixedHeight,

    fontSize: '20px',
    wrap: {
      mode: 'word',
      width: wrapWidth
    },
    maxLines: 2
  });
};
export { textBox };
