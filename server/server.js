require('dotenv').config()
const mongoose = require('mongoose')
const cors = require('cors')
const express = require('express')
const app = express()

const indexRouter = require('./routes/index')

const PORT = process.env.PORT || 5000


app.get('/test', (req, res) => {
    res.send('test route')
})

// Serve static files from React app in production (placed before routes to avoid catching assets in route params)
if (process.env.NODE_ENV === 'production') {
    const path = require('path')
    app.use(express.static(path.join(__dirname, '../client/build')))
}

// Enable CORS for all origins
app.use(cors())
app.use(express.json())
app.use('/', indexRouter)

// Serve React's index.html for non-API routes in production (fallback)
if (process.env.NODE_ENV === 'production') {
    const path = require('path')
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build', 'index.html'))
    })
}


mongoose.connect(process.env.DATABASE_URL, {
    useNewUrlParser: true, useUnifiedTopology: true
})
.then(() => console.log('Database connection successfull'))
.catch((err) => console.log('error in db connection', err));


app.listen(PORT, () => { console.log(`Server running on ${PORT}`) })