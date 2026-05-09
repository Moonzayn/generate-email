const express = require('express');
const axios = require('axios');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let emails = {};
let clients = [];

// ===================== WEBSOCKET =====================
wss.on('connection', (ws) => {
    clients.push(ws);
    ws.send(JSON.stringify({ type: 'connected', data: emails }));
    
    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
    });
});

function broadcast(data) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// ===================== PROVIDER 1: 1SECMAIL (FIXED) =====================
async function generate1SecMail() {
    try {
        const domains = ['1secmail.com', '1secmail.org', '1secmail.net', 'wwjmp.com', 'esiix.com', 'xojxe.com', 'yoggm.com'];
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let login = '';
        for (let i = 0; i < 10; i++) {
            login += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const email = `${login}@${domain}`;
        
        // Test dengan request check mailbox
        const testUrl = `https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`;
        await axios.get(testUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.1secmail.com/'
            }
        });
        
        return {
            address: email,
            login: login,
            domain: domain,
            provider: '1secmail'
        };
    } catch (error) {
        console.error('1secmail error:', error.message);
        return null;
    }
}

async function getInbox1SecMail(login, domain) {
    try {
        const response = await axios.get(
            `https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`,
            { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://www.1secmail.com/'
                }
            }
        );
        return response.data || [];
    } catch (error) {
        return [];
    }
}

async function getMessage1SecMail(login, domain, id) {
    try {
        const response = await axios.get(
            `https://www.1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${id}`,
            { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                    'Referer': 'https://www.1secmail.com/'
                }
            }
        );
        return response.data;
    } catch (error) {
        return null;
    }
}

// ===================== PROVIDER 2: MAIL.TM =====================
let mailTmToken = null;
let lastMailTmRequest = 0;

async function generateMailTm() {
    // Rate limit: minimal 2 detik antar request
    const now = Date.now();
    if (now - lastMailTmRequest < 2000) {
        await new Promise(resolve => setTimeout(resolve, 2000 - (now - lastMailTmRequest)));
    }
    lastMailTmRequest = Date.now();
    
    try {
        const domainsRes = await axios.get('https://api.mail.tm/domains', { 
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
        });
        const domains = domainsRes.data['hydra:member'];
        
        if (!domains || domains.length === 0) return null;
        
        const domain = domains[0].domain;
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let randomString = '';
        for (let i = 0; i < 10; i++) {
            randomString += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const email = `${randomString}@${domain}`;
        const password = Math.random().toString(36).substring(2, 14) + 'Aa1!';
        
        await axios.post('https://api.mail.tm/accounts', {
            address: email,
            password: password
        }, { 
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const tokenRes = await axios.post('https://api.mail.tm/token', {
            address: email,
            password: password
        }, { 
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        return {
            address: email,
            password: password,
            token: tokenRes.data.token,
            provider: 'mail.tm'
        };
    } catch (error) {
        console.error('mail.tm error:', error.message);
        return null;
    }
}

async function getInboxMailTm(token) {
    try {
        const response = await axios.get('https://api.mail.tm/messages', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            timeout: 10000
        });
        return response.data['hydra:member'] || [];
    } catch (error) {
        return [];
    }
}

async function getMessageMailTm(token, id) {
    try {
        const response = await axios.get(`https://api.mail.tm/messages/${id}`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        return null;
    }
}

// ===================== PROVIDER 3: MAIL.GW (Alternatif Mail.tm) =====================
async function generateMailGw() {
    try {
        const domainsRes = await axios.get('https://api.mail.gw/domains', { 
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
        });
        const domains = domainsRes.data['hydra:member'];
        
        if (!domains || domains.length === 0) return null;
        
        const domain = domains[0].domain;
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let randomString = '';
        for (let i = 0; i < 10; i++) {
            randomString += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const email = `${randomString}@${domain}`;
        const password = Math.random().toString(36).substring(2, 14) + 'Bb2@';
        
        await axios.post('https://api.mail.gw/accounts', {
            address: email,
            password: password
        }, { 
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const tokenRes = await axios.post('https://api.mail.gw/token', {
            address: email,
            password: password
        }, { 
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        return {
            address: email,
            password: password,
            token: tokenRes.data.token,
            provider: 'mail.gw'
        };
    } catch (error) {
        console.error('mail.gw error:', error.message);
        return null;
    }
}

async function getInboxMailGw(token) {
    try {
        const response = await axios.get('https://api.mail.gw/messages', {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            timeout: 10000
        });
        return response.data['hydra:member'] || [];
    } catch (error) {
        return [];
    }
}

async function getMessageMailGw(token, id) {
    try {
        const response = await axios.get(`https://api.mail.gw/messages/${id}`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        return null;
    }
}

// ===================== PROVIDER 4: DROPMAIL.ME =====================
async function generateDropmail() {
    try {
        const response = await axios.post('https://dropmail.me/api/graphql/web-test-wgq3v8e5p8nh', {
            query: `mutation { introduceSession { id, expiresAt, addresses { address } } }`
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        const session = response.data?.data?.introduceSession;
        if (session && session.addresses && session.addresses.length > 0) {
            return {
                address: session.addresses[0].address,
                sessionId: session.id,
                provider: 'dropmail'
            };
        }
        return null;
    } catch (error) {
        console.error('dropmail error:', error.message);
        return null;
    }
}

async function getInboxDropmail(sessionId) {
    try {
        const response = await axios.post('https://dropmail.me/api/graphql/web-test-wgq3v8e5p8nh', {
            query: `query ($id: ID!) { session(id: $id) { addresses { address }, mails { rawSize, fromAddr, toAddr, downloadUrl, text, headerSubject } } }`,
            variables: { id: sessionId }
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        return response.data?.data?.session?.mails || [];
    } catch (error) {
        return [];
    }
}

// ===================== MAIN GENERATOR =====================
async function generateEmail(preferredProvider = 'auto') {
    const providers = [
        { name: '1secmail', fn: generate1SecMail },
        { name: 'mailtm', fn: generateMailTm },
        { name: 'mailgw', fn: generateMailGw },
        { name: 'dropmail', fn: generateDropmail }
    ];
    
    // Jika provider spesifik dipilih
    if (preferredProvider !== 'auto') {
        const preferred = providers.find(p => p.name === preferredProvider);
        if (preferred) {
            const result = await preferred.fn();
            if (result) return result;
        }
    }
    
    // Coba semua provider secara berurutan
    for (const provider of providers) {
        try {
            const result = await provider.fn();
            if (result) {
                console.log(`   └─ Using provider: ${result.provider}`);
                return result;
            }
        } catch (error) {
            console.error(`${provider.name} failed:`, error.message);
        }
        // Delay antar provider
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return null;
}

// ===================== EXPRESS ROUTES =====================

// Generate single email
app.post('/api/generate', async (req, res) => {
    const { provider } = req.body || {};
    
    try {
        const result = await generateEmail(provider || 'auto');
        
        if (!result) {
            return res.status(500).json({ success: false, error: 'All providers failed' });
        }
        
        const email = result.address;
        
        emails[email] = {
            ...result,
            created_at: new Date().toISOString(),
            inbox: []
        };

        broadcast({ type: 'new_email', email: email, data: emails[email] });
        
        console.log(`✅ Generated: ${email} (${result.provider})`);
        res.json({ success: true, email: email, data: emails[email] });
    } catch (error) {
        console.error('Generate error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate multiple emails
app.post('/api/generate-multiple', async (req, res) => {
    const { count, provider } = req.body;
    const generated = [];
    const errors = [];
    
    console.log(`\n🚀 Generating ${count} emails...`);
    console.log(`   Provider: ${provider || 'auto'}\n`);
    
    for (let i = 0; i < count; i++) {
        try {
            console.log(`📧 [${i + 1}/${count}] Generating...`);
            const result = await generateEmail(provider || 'auto');
            
            if (result) {
                const email = result.address;
                
                emails[email] = {
                    ...result,
                    created_at: new Date().toISOString(),
                    inbox: []
                };

                generated.push(email);
                broadcast({ 
                    type: 'new_email', 
                    email: email, 
                    data: emails[email],
                    progress: { current: i + 1, total: count }
                });
                console.log(`✅ [${i + 1}/${count}] Generated: ${email}`);
            } else {
                errors.push(`Failed at ${i + 1}`);
                console.log(`❌ [${i + 1}/${count}] Failed - all providers down`);
            }
            
            // Delay lebih lama untuk hindari rate limit
            await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
            console.error(`❌ Error at ${i + 1}:`, error.message);
            errors.push(error.message);
        }
    }
    
    console.log(`\n🎉 Done! Generated ${generated.length}/${count} emails\n`);
    res.json({ success: true, generated, total: generated.length, errors });
});

// Get inbox
app.get('/api/inbox/:email', async (req, res) => {
    const { email } = req.params;
    
    if (!emails[email]) {
        return res.status(404).json({ error: 'Email not found' });
    }

    try {
        const emailData = emails[email];
        let inbox = [];
        
        if (emailData.provider === '1secmail') {
            const messages = await getInbox1SecMail(emailData.login, emailData.domain);
            
            for (const msg of messages) {
                const detail = await getMessage1SecMail(emailData.login, emailData.domain, msg.id);
                inbox.push({
                    id: msg.id,
                    from: msg.from,
                    subject: msg.subject,
                    date: msg.date,
                    text: detail ? detail.textBody : '',
                    html: detail ? detail.htmlBody : ''
                });
            }
        } else if (emailData.provider === 'mail.tm') {
            const messages = await getInboxMailTm(emailData.token);
            
            for (const msg of messages) {
                const detail = await getMessageMailTm(emailData.token, msg.id);
                inbox.push({
                    id: msg.id,
                    from: msg.from?.address || msg.from,
                    subject: msg.subject,
                    date: msg.createdAt,
                    text: detail ? detail.text : '',
                    html: detail ? detail.html : ''
                });
            }
        } else if (emailData.provider === 'mail.gw') {
            const messages = await getInboxMailGw(emailData.token);
            
            for (const msg of messages) {
                const detail = await getMessageMailGw(emailData.token, msg.id);
                inbox.push({
                    id: msg.id,
                    from: msg.from?.address || msg.from,
                    subject: msg.subject,
                    date: msg.createdAt,
                    text: detail ? detail.text : '',
                    html: detail ? detail.html : ''
                });
            }
        } else if (emailData.provider === 'dropmail') {
            const messages = await getInboxDropmail(emailData.sessionId);
            
            for (const msg of messages) {
                inbox.push({
                    id: Math.random().toString(36).substring(7),
                    from: msg.fromAddr,
                    subject: msg.headerSubject,
                    date: new Date().toISOString(),
                    text: msg.text || '',
                    html: ''
                });
            }
        }
        
        emails[email].inbox = inbox;
        broadcast({ type: 'inbox_update', email, inbox });
        
        res.json({ success: true, inbox });
    } catch (error) {
        console.error('Inbox error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all emails
app.get('/api/emails', (req, res) => {
    res.json({ success: true, emails, total: Object.keys(emails).length });
});

// Delete single email
app.delete('/api/email/:email', (req, res) => {
    const { email } = req.params;
    
    if (emails[email]) {
        delete emails[email];
        broadcast({ type: 'email_deleted', email });
        console.log(`🗑️ Deleted: ${email}`);
    }
    
    res.json({ success: true });
});

// Bulk delete
app.post('/api/delete-bulk', (req, res) => {
    const { emailList } = req.body;
    
    if (!emailList || !Array.isArray(emailList)) {
        return res.status(400).json({ success: false, error: 'Invalid email list' });
    }
    
    let deleted = 0;
    
    for (const email of emailList) {
        if (emails[email]) {
            delete emails[email];
            deleted++;
        }
    }
    
    broadcast({ type: 'bulk_deleted', emails: emailList, count: deleted });
    console.log(`🗑️ Bulk deleted: ${deleted} emails`);
    
    res.json({ success: true, deleted });
});

// Delete all
app.delete('/api/emails/all', (req, res) => {
    const count = Object.keys(emails).length;
    emails = {};
    
    broadcast({ type: 'all_deleted', count });
    console.log(`🗑️ Deleted all: ${count} emails`);
    
    res.json({ success: true, deleted: count });
});

// Export
app.get('/api/export', (req, res) => {
    const exportData = Object.keys(emails).map(email => ({
        email: email,
        provider: emails[email].provider,
        created_at: emails[email].created_at,
        inbox_count: emails[email].inbox?.length || 0
    }));
    
    res.json({ success: true, data: exportData });
});

// ===================== AUTO REFRESH INBOX =====================
setInterval(async () => {
    const emailList = Object.keys(emails);
    
    for (const email of emailList) {
        if (!emails[email]) continue;
        
        try {
            const emailData = emails[email];
            let newMessages = [];
            
            if (emailData.provider === '1secmail') {
                newMessages = await getInbox1SecMail(emailData.login, emailData.domain);
            } else if (emailData.provider === 'mail.tm') {
                newMessages = await getInboxMailTm(emailData.token);
            } else if (emailData.provider === 'mail.gw') {
                newMessages = await getInboxMailGw(emailData.token);
            } else if (emailData.provider === 'dropmail') {
                newMessages = await getInboxDropmail(emailData.sessionId);
            }
            
            const oldCount = emails[email].inbox?.length || 0;
            const newCount = newMessages.length;
            
            if (newCount > oldCount) {
                console.log(`📬 New mail for ${email}! (${oldCount} → ${newCount})`);
                axios.get(`http://localhost:${PORT}/api/inbox/${encodeURIComponent(email)}`).catch(() => {});
            }
        } catch (err) {
            // Silent fail
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}, 15000);

// ===================== START SERVER =====================
const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║       📧 TEMP EMAIL MANAGER - MULTI PROVIDER 📧       ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  🌐 Server: http://localhost:${PORT}                       ║
║                                                        ║
║  📦 Providers (Domain Jelas):                          ║
║     • 1SecMail    → @1secmail.com/org/net              ║
║     • Mail.tm     → @mail.tm domains                   ║
║     • Mail.gw     → @mail.gw domains                   ║
║     • Dropmail.me → @dropmail.me                       ║
║                                                        ║
║  ✨ Features:                                          ║
║     • Generate unlimited emails                        ║
║     • Bulk delete support                              ║
║     • Real-time inbox monitoring                       ║
║     • Auto-refresh every 15s                           ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
});