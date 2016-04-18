var Micex = require('micex.api');

Micex.securityMarketdata('USD000UTSTOM')
  .then(function (security) {
     console.log(security.node.last); // e.g. 64.04 
     console.log(security);
  });