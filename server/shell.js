import os from 'os';
import pty from 'node-pty';
import { Picker } from 'meteor/meteorhacks:picker';
import WebSocket from 'ws';

// Right now only one terminal can run at a time
// but in the future, web-shell may support running
// multiple simultaneously.
var wss = new WebSocket.Server({ port: 8080 }),
    terminals = {},
    logs = {}
;

Picker.route('/web-shell/terminals', (params, req, res) => {
  let cols = parseInt(params.query.cols),
      rows = parseInt(params.query.rows)
  ;

  if (_.size(terminals) === 0) {
    let term = pty.spawn('meteor', ['shell'], {
          name: 'xterm-color',
          cols: cols,
          rows: rows,
          cwd: process.env.PWD,
          env: process.env
        });

    terminals[term.pid] = term;
    logs[term.pid] = '';

    term.on('data', stripPreamble(data => {
      logs[term.pid] += data;
    }));
  }

  let term = Object.values(terminals)[0];
  term.resize(cols, rows);
  res.end(term.pid.toString());
});

Picker.route('/web-shell/terminals/:pid/size', (params, req, res) => {
  var pid = parseInt(params.pid),
      cols = parseInt(params.query.cols),
      rows = parseInt(params.query.rows),
      term = terminals[pid]
  ;

  console.log(cols, rows);
  term.resize(cols, rows);
  res.end();
});

wss.on('connection', (ws, req) => {
  let url = req
      ? req.url
      : ws.upgradeReq.url
  ;

  var term = terminals[parseInt(url.split('/').pop())];
  ws.send(logs[term.pid]);

  term.on('data', stripPreamble(data => {
    try {
      ws.send(data);
    } catch (ex) {
      // The WebSocket is not open, ignore
    }
  }));

  ws.on('message', msg => {
    if (msg !== '---heartbeat---') {
      term.write(msg);
    }
  });

});

// This needs work
let stripped = false;
let stripPreamble = function(handler) {
  return data => {
    if (stripped) {
      return handler(data);
    }

    if (data.includes('>') && !data.includes('<')) {
      stripped = true;
      return handler('> ');
    }
  };
};
