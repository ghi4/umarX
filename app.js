const { Client } = require('whatsapp-web.js');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { response } = require('express');
const port = process.env.PORT || 8000;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// API
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// SESSION
const SESSION_FILE_PATH = './whatsapp-session.json';
let sessionCfg;
if(fs.existsSync(SESSION_FILE_PATH)){
    sessionCfg = require(SESSION_FILE_PATH);
}

// SERVER
app.get('/', (req, res) => {
    res.sendFile('index.html', {root: __dirname});
})

// CLIENT
const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    },
    session: sessionCfg
});

// AUTHENTICATED
// when QR Code scanned
client.on('authenticated', (session) => {
    console.log('AUTHENTICATED', session);
    sessionCfg = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function(err){
        if(err){
            console.error(err);
        }
    });
});

// INCOMING MESSAGE
// when whatsapp receive message
client.on('message', msg => {
    msg.reply('Perintah tidak dikenal. Mohon hubungi pengembang untuk pesan lebih lanjut.');
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

// INITIALIZE
client.initialize();

// Socket.io
io.on('connection', function(socket){
    socket.emit('message', 'Connected');

    client.on('qr', (qr) => {
        // Generate and scan this code with your phone
        console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit('qrcode', url);
            socket.emit('message', 'QR Code Receivedx.')
        })
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        socket.emit('message', 'Client is ready.')
    });
});

const isNumberRegistered = async function(number) {
    const isRegistered = await client.isRegisteredUser(number);
    return isRegistered;
}

//Send message
app.post('/send-message', async (req, res) => {
    const number = req.body.number;
    const message = req.body.message;

    const isRegis = await isNumberRegistered(number);

    if(!isRegis) {
        return res.status(422).json({
            status: false,
            message: 'The number is not registered'
        });
    }

    client.sendMessage(number, message).then(response => {
        res.status(200).json({
            status: true,
            response: response
        })
    }).catch(err => {
        res.status(500).json({
            status: false,
            response: err
        })
    });
})


server.listen(port, function() {
    console.log("App running!");
});