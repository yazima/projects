(function(ext) {

  let callGetPlayerPos = [];
  let callGetBlock = [];
  let blockHits = false;
  let ws = null;
  let id = setInterval(cyclic, 2000);

  function cyclic() {
    connect();
    checkEvent();
  }

  function isConnect() {
    if (ws && (ws.readyState == WebSocket.OPEN)) {
      return true;
    }
    return false;
  }

  function connect() {
    if (ws) {
      if (ws.readyState != WebSocket.CLOSED) {
        return;
      }
    }
    ws = null;
    ws = new WebSocket('ws://localhost:14711');
    // イベントハンドラの設定
    ws.onmessage = onMessage;
  }

  function checkEvent() {
    send('events.block.hits()');
  }

  function send(cmd) {
    if (!isConnect()) {
      return;
    }
    console.log(cmd);
    ws.send(cmd);
  }

  function onMessage(event) {
    console.log(event);

    let message = event.data.trim();
    if ((message.length == 0) || (message.indexOf('|') >= 0)) {
      eventBlockHits(message);
    }

    // 今の所、カンマの数でイベントを判別可能
    let data = message.split(',');
    switch(data.length) {
      case 2:
        eventGetBlock(data);
        break;
      case 3:
        eventGetPlayerPos(data);
        break;
      default:
        eventBlockHits(message);
    }
  }

  function eventGetPlayerPos(data) {
    let back = callGetPlayerPos.shift();
    if (!back) {
      return;
    }

    let pos;
    if ('x' == back.posCoord) {
      pos = data[0];
    } else if ('y' == back.posCoord) {
      pos = data[1];
    } else {
      pos = data[2];
    }
    back.callback(pos);
  }

  function eventGetBlock(data) {
    let back = callGetBlock.shift();
    if (!back) {
      return;
    }

    let bd;
    if ('id' == back.blockData) {
      bd = data[0];
    } else {
      bd = data[1];
    }
    back.callback(bd);
  }

  function eventBlockHits(message) {
    if (message.length > 0) {
      blockHits = true;
    } else {
      blockHits = false;
    }
  }

  function setBlock(x, y, z, blockType, blockData) {
    let cmd = 'world.setBlock(' + x + ',' + y + ',' + z + ',' + blockType;
    if (-1 != blockData) {
      cmd += ',' + blockData;
    }
    cmd += ')';
    send(cmd);
  }

  function setBlocks(x1, y1, z1, x2, y2, z2, blockType, blockData) {
    let cmd = 'world.setBlocks(' + x1 + ',' + y1 + ',' + z1 + ',' + x2 + ',' + y2 + ',' + z2 + ',' + blockType;
    if (-1 != blockData) {
      cmd += ',' + blockData;
    }
    cmd += ')';
    send(cmd);
  }
  
  function setLine(x1, z1, x2, z2, y, blockType, blockData) {
    let tmp;
    let steep = Math.abs(z2 - z1) > Math.abs(x2 - x1);
    if (steep) {
      // swap x1,z1
      tmp = x1; x1 = z1; z1 = tmp;
      // swap x2,z2
      tmp = x2; x2 = z2; z2 = tmp;
    }
  
    let sign = 1;
    if (x1 > x2) {
      sign = -1;
      x1 *= -1;
      x2 *= -1;
    }
    let dx = x2 - x1;
    let dy = Math.abs(z2 - z1);
    let err = ((dx/2));
    let zstep = z1 < z2 ? 1:-1;
    let z = z1;
  
    for (let x = x1; x <= x2; x++) {
      if (steep) {
        setBlock(z, y, sign * x, blockType, blockData);
      } else {
        setBlock(sign * x, y, z, blockType, blockData);
      }
      err = (err - dy);
      if (err < 0) {
        z += zstep;
        err += dx;
      }
    }
  }

  function setCircle(x0, z0, r, y0, blockType, blockData) {
    let x = 0;
    let z = r;
    let f = 1 - r;
    let ddf_x = 1;
    let ddf_z = -2 * r;
    setBlock(x0, y0, z0 + r, blockType, blockData);
    setBlock(x0, y0, z0 - r, blockType, blockData);
    setBlock(x0 + r, y0, z0, blockType, blockData);
    setBlock(x0 - r, y0, z0, blockType, blockData);

    while (x < z) {
      if (f >= 0) {
        z -= 1;
        ddf_z += 2;
        f += ddf_z;
      }
      x += 1;
      ddf_x += 2;
      f += ddf_x;
      setBlock(x0 + x, y0, z0 + z, blockType, blockData);
      setBlock(x0 - x, y0, z0 + z, blockType, blockData);
      setBlock(x0 + x, y0, z0 - z, blockType, blockData);
      setBlock(x0 - x, y0, z0 - z, blockType, blockData);
      setBlock(x0 + z, y0, z0 + x, blockType, blockData);
      setBlock(x0 - z, y0, z0 + x, blockType, blockData);
      setBlock(x0 + z, y0, z0 - x, blockType, blockData);
      setBlock(x0 - z, y0, z0 - x, blockType, blockData);
    }
  }
  
  ext._shutdown = function() {
    clearInterval(id);
    if (ws) {
      ws.close();
    }
    ws = null;
  };
   
  ext._getStatus = function() {
    if (isConnect()) {
      return {status: 2, msg: 'Ready'};
    }
    return {status: 1, msg: 'Not Ready'};
  };

  // get one coord (x, y, or z) for playerPos
  ext.getPlayerPos = function(posCoord, callback) {
    if (!isConnect()) {
      callback(null);
      return;
    }
    back = {
      'posCoord': posCoord,
      'callback': callback
    };
    callGetPlayerPos.push(back);
    ws.send('player.getTile()');
  };
  
  // get block.id or block.data
  ext.getBlock = function(x, y, z, blockData, callback) {
    if (!isConnect()) {
      callback(null);
      return;
    }
    back = {
      'blockData': blockData,
      'callback': callback
    };
    callGetBlock.push(back);
    ws.send('world.getBlockWithData(' + x + ',' + y + ',' + z + ')');
  };

  ext.setPlayerPos = function(x, y, z) {
    send('player.setPos(' + x + ',' + y + ',' + z + ')');
  };

  ext.setBlock = function(x, y, z, blockType, blockData) {
    setBlock(x * 1, y * 1, z * 1, blockType * 1, blockData * 1);
  };

  ext.setLine = function(x1, z1, x2, z2, y, blockType, blockData) {
    setLine(x1 * 1, z1 * 1, x2 * 1, z2 * 1, y * 1, blockType * 1, blockData * 1);
  };

  ext.setBlocks = function(x1, y1, z1, x2, y2, z2, blockType, blockData) {
    setBlocks(x1 * 1, y1 * 1, z1 * 1, x2 * 1, y2 * 1, z2 * 1, blockType * 1, blockData * 1);
  };

  ext.setCircle = function(x, z, r, y, blockType, blockData) {
    setCircle(x * 1, z * 1, r * 1, y * 1, blockType * 1, blockData * 1);
  };

  ext.postToChat = function(str) {
    send('chat.post(' + str + ')');
  };

  ext.whenBlockHit = function(str) {
    if (!blockHits)
        return;
    else
        return true;
  };

  // ScratchXに表示する命令ブロックを定義
  var descriptor = {
    blocks: [
      ["R", "所 自分の %m.pos 座標を調べる", "getPlayerPos", "x"],
      ["R", "調 x:%n y:%n z:%n にあるブロックの %m.blockData を調べる", "getBlock", 0, 0, 0, "id"],
      [" ", "動 x:%n y:%n z:%n に移動", "setPlayerPos", 0, 0, 0],
      [" ", "点 x:%n y:%n z:%n に %n （ %n ） のブロックを置く", "setBlock", 0, 0, 0, 1, -1],
      [" ", "線 x1:%n z1:%n から x2:%n z2:%n までの線を y %n の高さに %n （ %n ） で作る", "setLine", 0, 0, 0, 0, 0, 1, -1],
      [" ", "箱 x1:%n y1:%n z1:%n から x2:%n y2:%n z2:%n まで %n （ %n ） で埋める", "setBlocks", 0, 0, 0, 0, 0, 0, 1, -1],
      [" ", "丸 x1:%n z1:%n を中心に 半径 %n の円をy %n の高さに %n （ %n ） で作る", "setCircle", 0, 0, 1, 0, 1, -1],
      [" ", "話 %s と言う", "postToChat", "Hellow"],
      ["h", "剣でブロックを右クリック", "whenBlockHit"]
    ],
    menus: {
      "pos": ["x", "y", "z"],
      "blockType": ["wood", "stone"],
      "blockPos": ["絶対値", "相対値"],
      "blockData": ['id', 'data']
    }
  };
   
  // ScratchXに登録する
  ScratchExtensions.register('MCPI-Py', descriptor, ext);
})({});
