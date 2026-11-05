import axios from 'axios';
import { io } from 'socket.io-client';
import { API_URL } from './constants';

export const api = axios.create({ baseURL: API_URL, timeout: 10000 });

// One shared realtime connection for the whole app
export const socket = io(API_URL, { autoConnect: false });