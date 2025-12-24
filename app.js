const express = require('express');
const { Redis } = require('@upstash/redis');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

// --- KONFIGURASI UPSTASH ---
const redis = new Redis({
  url: 'REPLACE_WITH_URL',
  token: 'REPLACE_WITH_TOKEN',
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- ROUTES ---

// Login & Register
app.get('/', (req, res) => {
    if(req.cookies.user) return res.redirect('/dashboard');
    res.render('index');
});

app.post('/auth', async (req, res) => {
    const { username, password, action } = req.body;
    const userKey = `user:${username.toLowerCase()}`;
    
    const existingUser = await redis.get(userKey);

    if (action === 'register') {
        if (existingUser) return res.send("Username sudah ada!");
        await redis.set(userKey, { username, password });
        res.cookie('user', username);
        res.redirect('/dashboard');
    } else {
        if (existingUser && existingUser.password === password) {
            res.cookie('user', username);
            res.redirect('/dashboard');
        } else {
            res.send("Login Gagal! Username/Password salah.");
        }
    }
});

// Dashboard - Lihat Pesan
app.get('/dashboard', async (req, res) => {
    const username = req.cookies.user;
    if(!username) return res.redirect('/');
    
    // Ambil semua pesan dari list Redis
    const messages = await redis.lrange(`msgs:${username.toLowerCase()}`, 0, -1);
    res.render('dashboard', { username, messages, host: req.get('host') });
});

app.get('/logout', (req, res) => {
    res.clearCookie('user');
    res.redirect('/');
});

// Halaman Kirim Pesan (Public)
app.get('/u/:username', async (req, res) => {
    const user = await redis.get(`user:${req.params.username.toLowerCase()}`);
    if(!user) return res.send("User tidak ditemukan");
    res.render('profile', { target: req.params.username });
});

app.post('/send/:username', async (req, res) => {
    const msgData = {
        content: req.body.message,
        time: new Date().toLocaleTimeString()
    };
    // Simpan ke list Redis
    await redis.lpush(`msgs:${req.params.username.toLowerCase()}`, JSON.stringify(msgData));
    res.render('success', { target: req.params.username });
});

module.exports = app;
app.listen(3000);
