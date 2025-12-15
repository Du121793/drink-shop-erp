import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:4000', // Assuming the backend is running on port 4000
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
});

export default instance;
