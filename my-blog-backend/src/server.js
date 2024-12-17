import fs from 'fs';
import admin, { auth } from 'firebase-admin';
import express from 'express';
import { db, connectToDb } from './db.js';

const credentials = JSON.parse(
    fs.readFileSync('./credentials.json')
);
admin.initializeApp({
    credential: admin.credential.cert(credentials),
});

const app = express();
app.use(express.json());

app.use(async (req, res, next) => {
    const { authToken } = req.headers;

    if (authToken) {
        try {
            req.user = await admin.auth().verifyIdToken(authToken);
        } catch (e) {
            res.sendStatus(404);
        }
    }

    next();
});

app.get('/api/articles/:name', async (req, res) => {
    const { name } = req.params;
    const { uid } = req.user;

    const article = await db.collection('articles').findOne({ name });

    if (article) {
        const upvoteIds = article.upvoteIds || [];
        article.canUpvote = uid && !upvoteIds.include(uid);
        res.json(article);
    } else {
        res.sendStatus(404);
    }
});

app.put('/api/articles/:name/upvote', async (req, res) => {
    const { name } = req.params;

    await db.collection('articles').updateOne({ name }, {
        $inc: { upvotes: 1 },
    });
    const article = await db.collection('articles').findOne({ name });

    if (article) {
        res.json(article);
    } else {
        res.send('That article doesn\'t exist');
    }
});

app.post('/api/articles/:name/comments', async (req, res) => {
    const { name } = req.params;
    const { postedBy, text } = req.body;

    await db.collection('articles').updateOne({ name }, {
        $push: { comments: { postedBy, text } },
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

connectToDb(() => {
    console.log('Successfully connected to database!');
    app.listen(8000, () => {
        console.log('Server is listening on port 8000');
    });
});