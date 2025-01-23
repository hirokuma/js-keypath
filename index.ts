import * as rpc from './bitcoinrpc.js';

(async () => {
    const res = await rpc.request('getblockcount');
    console.log(res);
})();
