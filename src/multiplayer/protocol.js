export const C2S = {
  JOIN:            'join',
  MAP:             'map',
  MOVE:            'move',
  PROFILE:         'profile', // live profile patch (name, sprite, follower…)
  INTERACT_TARGET: 'interact-target',
  TRADE_REQUEST:   'trade-request',
  TRADE_OFFER:     'trade-offer',
  TRADE_CONFIRM:   'trade-confirm',
  TRADE_CANCEL:    'trade-cancel',
  BATTLE_REQUEST:  'battle-request',
  BATTLE_READY:    'battle-ready',
  BATTLE_ACTION:   'battle-action',
  CHAT:            'chat',
  PING:            'ping',
  CREATE_ROOM:     'create-room',
  JOIN_GLOBAL:     'join-global',
  JOIN_ROOM:       'join-room',
  LEAVE_ROOM:      'leave-room',
};

export const S2C = {
  JOINED:         'joined',
  PLAYER_JOINED:  'player-joined',
  PLAYER_LEFT:    'player-left',
  PLAYER_MOVE:    'player-move',
  PLAYER_MAP:     'player-map',
  PLAYER_PROFILE: 'player-profile',
  CHAT:           'chat',
  PONG:           'pong',
  ERROR:          'error',
  ROOM_CODE:      'room-code',
};
