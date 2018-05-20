require.config({
  baseUrl: '../dist',
  paths:   {
    'kodak-scanner': 'kodak-scanner.umd.min',
  },
});


requirejs(['kodak-scanner' ], function(KScanner) {
  initScanner(KScanner.init)
});

