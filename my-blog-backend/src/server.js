import fs from 'fs';
import admin from 'firebase-admin';
import express from 'express';
import { db, connectToDb } from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const credentials = JSON.parse(
    fs.readFileSync('./credentials.json')
);
admin.initializeApp({
    credential: admin.credential.cert(credentials),
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../build')));

app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
});

app.use(async (req, res, next) => {
    const { authToken } = req.headers;

    if (authToken) {
        try {
            req.user = await admin.auth().verifyIdToken(authToken);
        } catch (e) {
            return res.sendStatus(404);
        }
    }

    req.user = req.user || {};

    next();
});

app.get('/api/articles/:name', async (req, res) => {
    const { name } = req.params;
    const { uid } = req.user;

    const article = await db.collection('articles').findOne({ name });

    if (article) {
        const upvoteIds = article.upvoteIds || [];
        article.canUpvote = uid && !upvoteIds.includes(uid);
        res.json(article);
    } else {
        res.sendStatus(404);
    }
});

app.use((req, res, next) => {
    if (req.user) {
        next();
    } else {
        res.sendStatus(401);
    }
});

app.put('/api/articles/:name/upvote', async (req, res) => {
    const { name } = req.params;
    const { uid } = req.user;

    const article = await db.collection('articles').findOne({ name });

    if (article) {
        const upvoteIds = article.upvoteIds || [];
        const canUpvote = uid && !upvoteIds.includes(uid);

        if (canUpvote) {
            await db.collection('articles').updateOne({ name }, {
                $inc: { upvotes: 1 },
                $push: { upvoteIds: uid },
            });
        }

        const updatedArticle = await db.collection('articles').findOne({ name });
        res.json(updatedArticle);
    } else {
        res.send('That article doesn\'t exist');
    }
});

app.post('/api/articles/:name/comments', async (req, res) => {
    const { name } = req.params;
    const { text } = req.body;
    const { email } = req.user;

    await db.collection('articles').updateOne({ name }, {
        $push: { comments: { postedBy: email, text } },
    });
    const article = await db.collection('articles').findOne({ name });

    if (article) {
        res.json(article);
    } else {
        res.send('That article doesn\'t exist');
    }
});

// app.post('/api/reset', async (req, res) => {
//     const defaultData = [
//         { name: 'learn-react', upvotes: 0, comments: [] },
//         { name: 'learn-node', upvotes: 0, comments: [] },
//         { name: 'mongodb', upvotes: 0, comments: [] },
//     ];

//     try {
//         // Clear the collection
//         await db.collection('articles').deleteMany({});

//         // Insert default data
//         await db.collection('articles').insertMany(defaultData);

//         res.send('Data has been reset to default state!');
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('Error resetting the data.');
//     }
// });

const PORT = process.env.PORT || 8000;

connectToDb(() => {
    console.log('Successfully connected to database!');
    app.listen(PORT, () => {
        console.log('Server is listening on port ' + PORT);
    });
});