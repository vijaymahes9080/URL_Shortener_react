const Url = require('../models/Url')
const validateUrl = require('../utils/validateUrl')
const generateUniqueId = require('../utils/generateUniqueId')
const fs = require('fs')
const path = require('path')

// Path to local offline JSON database file
const dbFilePath = path.join(__dirname, '../urls.json')

// Helper to read local JSON database
function readLocalDb() {
    try {
        if (fs.existsSync(dbFilePath)) {
            return JSON.parse(fs.readFileSync(dbFilePath, 'utf8'))
        }
    } catch (e) {
        console.error("Error reading local DB file", e)
    }
    return []
}

// Helper to write to local JSON database
function writeLocalDb(data) {
    try {
        fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf8')
    } catch (e) {
        console.error("Error writing to local DB file", e)
    }
}

// Helper to check if MongoDB is active
function isMongoActive() {
    return !!process.env.DATABASE_URL
}

async function createShortUrl(req, res) {
    const { url } = req.body
    const clientUrl = process.env.BASE_URL || 'http://localhost:5000'

    // checking if the url is valid or not
    if(!validateUrl(url)) {
        res.status(400).json({message: 'Invalid URL'})
        return
    }
    
    try {
        let urlDoc = null
        
        if (isMongoActive()) {
            // checking if original url is already present in MongoDB
            urlDoc = await Url.findOne({ url })
        } else {
            // checking in local offline database
            const localDb = readLocalDb()
            urlDoc = localDb.find(item => item.url === url)
        }

        if(urlDoc) {
            const shortUrl = `${clientUrl}/${urlDoc.shortUrlId}`
            res.status(200).json({shortUrl: shortUrl, clicks: urlDoc.clicks})
            console.log('Url already present', shortUrl)
            return
        }
    
        // creating short url using nanoid
        const shortUrlId = await generateUniqueId()

        if (isMongoActive()) {
            const newUrlDoc = new Url({
                url,
                shortUrlId,
                date: new Date()
            })
            await newUrlDoc.save()
        } else {
            const localDb = readLocalDb()
            const newUrlDoc = {
                _id: String(Date.now()),
                url,
                shortUrlId,
                clicks: 0,
                date: new Date()
            }
            localDb.push(newUrlDoc)
            writeLocalDb(localDb)
        }
        
        const shortUrl = `${clientUrl}/${shortUrlId}`
        res.status(200).json({shortUrl: shortUrl, clicks: 0})    
    }
    catch(err) {
        console.log(err)
        res.status(500).json({message: 'Server Error'})
    }
}


async function redirectToOriginalUrl(req, res) {
    const { shortUrlId } = req.params

    try {
        let urlDoc = null

        if (isMongoActive()) {
            urlDoc = await Url.findOne({shortUrlId})
            if(urlDoc === null) {
                res.status(404).json({message: 'No Url found'})
                return
            } 
            // $inc increase the clicks by 1
            await Url.findByIdAndUpdate(urlDoc._id, { $inc: { "clicks" : 1 } })
        } else {
            const localDb = readLocalDb()
            const index = localDb.findIndex(item => item.shortUrlId === shortUrlId)
            if (index === -1) {
                res.status(404).json({message: 'No Url found'})
                return
            }
            localDb[index].clicks += 1
            urlDoc = localDb[index]
            writeLocalDb(localDb)
        }

        // redirect to the original url
        return res.status(200).redirect(urlDoc.url)
    }
    catch(err) {
        console.log(err)
        res.status(500).json('Server Error')
    }
}


async function deleteUrl(req, res) {
    const { url } = req.body
    console.log(url)
    try {
        let deletedCount = 0

        if (isMongoActive()) {
            const deletedUrl = await Url.deleteOne({url})
            deletedCount = deletedUrl.deletedCount
        } else {
            const localDb = readLocalDb()
            const initialLength = localDb.length
            const filteredDb = localDb.filter(item => item.url !== url)
            deletedCount = initialLength - filteredDb.length
            if (deletedCount > 0) {
                writeLocalDb(filteredDb)
            }
        }

        if(deletedCount == 0) {
            res.status(400).json({message: 'No such url found'})
            return
        }
        res.status(200).json({message: `Url ${url} deleted`})
    }
    catch(err) {
        console.log(err)
        res.status(500).json({message: 'Server Error'})
    }
}

module.exports = {
    createShortUrl,
    redirectToOriginalUrl,
    deleteUrl
}