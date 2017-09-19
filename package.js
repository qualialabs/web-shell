Package.describe({
  name: 'qualia:web-shell',
  version: '0.0.6',
  summary: 'Meteor shell access in the browser',
  git: 'https://github.com/qualialabs/web-shell',
  documentation: 'README.md',
  debugOnly: true,
});

Npm.depends({
  'node-pty': '0.7.0',
  'ws': '3.1.0',
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@1.4');

  api.use([
    'ecmascript',
    'underscore',
    'spacebars-compiler',
    'templating',
    'blaze',
    'reactive-var',
    'meteorhacks:picker@1.0.3',
  ], ['client', 'server']);

  api.mainModule('client/main.js', 'client');
  api.mainModule('server/main.js', 'server');
});
