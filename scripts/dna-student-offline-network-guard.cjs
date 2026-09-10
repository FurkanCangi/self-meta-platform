// Test-process guard: supplied in-memory mocks remain usable, real sockets do not.
// This file is not imported by the application or any production route.
const net = require('node:net');
net.Socket.prototype.connect = function () {
  throw new Error('offline_regression_real_socket_forbidden');
};
