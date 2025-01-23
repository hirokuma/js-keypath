import fetch from 'node-fetch';
import _config from './config.json' assert { type: 'json' };
const config: Config = _config;

interface Config {
    network: string;
    rpcuser: string;
    rpcpass: string;
    rpcport: number;
};

type RpcResponse = {
    id: string;
    error: string;
    result: any;
};

const RPCID = 'p2tr';

export async function request(method: string, ...params: string[]) {
    const body = JSON.stringify({
        jsonrpc: '2.0',
        id: RPCID,
        method,
        params,
    });
    try {
        const response = await fetch(`http://localhost:${config.rpcport}`, {
            method: 'post',
            body,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(`${config.rpcuser}:${config.rpcpass}`),
            }
        });
        const res = await response.json() as RpcResponse;
        if (!res || res.id !== RPCID) {
            throw new Error('invalid response: ' + method);
        }
        if (res.error) {
            throw res.error;
        }
        return res.result;
    } catch (e: any) {
        console.error(`bitcoinrpc.request error: ${e}`);
        throw e;
    }
}
