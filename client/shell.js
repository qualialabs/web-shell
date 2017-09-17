import Terminal from './xterm';

Template.webTerm.onCreated(function() {
  let tpl = this;

  _.extend(tpl, {

    visible: new ReactiveVar(false),
    status: new ReactiveVar('inactive'),

    initialize() {
      tpl.bindEvents();
      tpl.startHeartbeat();
    },

    bindEvents() {
      $(document.body).on('keydown.webTerm', async e => {
        if (!e.ctrlKey || e.keyCode !== 222) {
          return;
        }

        if (tpl.status.get() === 'inactive') {
          await tpl.connectShell();
        }

        Tracker.afterFlush(tpl.toggleVisibility);
      });

      $(window).on('resize', _.debounce(() => {
        if (tpl.status.get() !== 'connected') {
          return;
        }

        let { cols, rows } = tpl.calcFit(),
            url = '/web-shell/terminals/' + tpl.shellPID + '/size?cols=' + cols + '&rows=' + rows;

        tpl.term.resize(cols, rows);
        fetch(url, {method: 'POST'});
      }, 500));

      tpl.autorun(comp => {
        if (Meteor.status().connected && tpl.status.get() === 'disconnected') {
          tpl.connectShell();
        }
      });
    },

    calcFit() {
      let webTerm = tpl.$('webTerm'),
          width = webTerm.width(),
          height = webTerm.height(),
          fontHeight = parseInt(webTerm.css('fontSize')),
          fontWidth = 0.6 * fontHeight,
          lineHeight = 15
      ;
      return {
        cols: Math.floor(width / fontWidth),
        rows: Math.floor(height / lineHeight),
      };
    },

    async connectShell() {
      if (tpl.status.get() === 'connecting' || tpl.status.get() === 'connected') {
        return;
      }

      tpl.status.set('connecting');
      tpl.createTerminal();

      let { cols, rows } = tpl.calcFit(),
          res = await fetch('/web-shell/terminals?cols=' + cols + '&rows=' + rows, {method: 'POST'}),
          shellPID = await res.text(),
          protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://',
          socketURL = protocol + location.hostname + ':8080/web-shell/terminals/' + shellPID
      ;

      tpl.shellPID = shellPID;
      tpl.socket = new WebSocket(socketURL);

      tpl.socket.onopen = () => {
        tpl.term.clear();
        tpl.term.reset()
        tpl.term.attach(tpl.socket);

        tpl.status.set('connected');
      };
      tpl.socket.onclose = () => {
        tpl.term.detach(tpl.socket);
        tpl.printReconnecting();

        tpl.status.set('disconnected');
      };

    },

    createTerminal() {
      if (tpl.term) {
        return;
      }

      let { cols, rows } = tpl.calcFit();
      tpl.term = new Terminal({
        cursorBlink: true,
        scrollback: 1000,
        tabStopWidth: 4,
        cols,
        rows,
      });
      window.tpl = tpl;

      tpl.term.open(tpl.$('webTerm')[0]);
    },

    startHeartbeat() {
      Meteor.setInterval(() => {
        if (tpl.status.get() === 'connected') {
          tpl.socket.send('---heartbeat---');
        }
      }, 10000);
    },

    printReconnecting() {
      let message = 'Reconnecting...',
          { cols, rows } = tpl.calcFit(),
          newlines = _
            .range(Math.floor(rows / 2) - 1)
            .map(() => '\n')
            .join(''),
          spaces = _
            .range(Math.floor(cols/2 - message.length/2) + 1)
            .map(() => ' ')
            .join('')
      ;

      tpl.term.clear();
      tpl.term.reset()
      tpl.term.write(newlines + spaces + message)
    },

    toggleVisibility() {
      if (tpl.visible.get()) {
        tpl.term.blur();
      }
      else {
        tpl.term.focus();
      }

      tpl.$('webTerm').toggleClass('termVisible');
      tpl.$('webTerm').toggleClass('termHidden');

      tpl.visible.set(!tpl.visible.get());
    },

  }).initialize();

});


Template.webTerm.onDestroyed(function() {
  console.log('destroyed');
});
