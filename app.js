
const express = require('express');
const { Redis } = require('@upstash/redis');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

// --- KREDENSI UPSTASH KAMU ---
const redis = new Redis({
  url: 'https://growing-firefly-50232.upstash.io',
  token: 'AcQ4AAIncDFlYjI2ZWM2ODhmOGQ0N2YwOTI1Njg5ZDA3ZjRjMDdhMHAxNTAyMzI',
});

// FIX: Setting path folder views agar terbaca di Vercel
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// --- ROUTES ---

// Halaman Depan
app.get('/', (req, res) => {
    if(req.cookies.user) return res.redirect('/dashboard');
    res.render('index');
});

// Auth: Login & Daftar
app.post('/auth', async (req, res) => {
    const { username, password, action } = req.body;
    if (!username || !password) return res.send("Isi semua field!");
    
    const userKey = `user:${username.toLowerCase()}`;
    const existingUser = await redis.get(userKey);

    if (action === 'register') {
        if (existingUser) return res.send("Username sudah diambil!");
        await redis.set(userKey, { username, password });
        res.cookie('user', username);
        res.redirect('/dashboard');
    } else {
        if (existingUser && existingUser.password === password) {
            res.cookie('user', username);
            res.redirect('/dashboard');
        } else {
            res.send("Username atau Password salah!");
        }
    }
});

// Dashboard: List Pesan
app.get('/dashboard', async (req, res) => {
    const username = req.cookies.user;
    if(!username) return res.redirect('/');
    
    const messages = await redis.lrange(`msgs:${username.toLowerCase()}`, 0, -1);
    res.render('dashboard', { username, messages, host: req.get('host') });
});

// Profile Public: Tempat orang kirim pesan
app.get('/u/:username', async (req, res) => {
    const user = await redis.get(`user:${req.params.username.toLowerCase()}`);
    if(!user) return res.status(404).send("User tidak ditemukan");
    res.render('profile', { target: req.params.username });
});

// Action: Kirim pesan ke Redis
app.post('/send/:username', async (req, res) => {
    const msgData = {
        content: req.body.message,
        time: new Date().toLocaleString('id-ID')
    };
    await redis.lpush(`msgs:${req.params.username.toLowerCase()}`, JSON.stringify(msgData));
    res.render('success', { target: req.params.username });
});

app.get('/logout', (req, res) => {
    res.clearCookie('user');
    res.redirect('/');
});

module.exports = app;

// Jalankan server jika lokal
if (process.env.NODE_ENV !== 'production') {
    app.listen(3000, () => console.log('Running on http://localhost:3000'));
}
