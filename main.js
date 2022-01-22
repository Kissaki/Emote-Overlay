'use strict'

class Settings {
    showEmoteCommands = ['!showemote', '!#showemote', '!showe', '!show', '!s']
    constructor() {
        this.parseFromURL()
        this.validate()
    }
    parseFromURL() {
        let params = new URL(document.location).searchParams

        this.channel = params.get("channel")?.toLowerCase()

        // show emote streaks
        this.streakEnabled = params.get("streakEnabled", 1); 
        this.minStreak = params.get("minStreak") ?? 5

        // enable show emote command
        this.showEmoteEnabled = params.get("showEmoteEnabled") ?? 1
        this.showEmoteSizeMultiplier = params.get("showEmoteSizeMultiplier") ?? 1
        this.showEmoteCooldown = params.get("showEmoteCooldown", 6);

        this.sevenTVEnabled = params.get("7tv") ?? 0

        this.debug = params.has("debug")
    }
    validate() {
        if (this.channel === null) throw 'Missing required `channel` configuration'
    }
}

class Logger {
    #debug = false
    /**
     * @param {boolean} enableDebug 
     */
    constructor(enableDebug) {
        this.#debug = enableDebug
    }
    debug(message) {
        if (!this.#debug) return
        console.log(message)
    }
}

class Emote {
    /** @type {string} */
    emoteName
    /** @type {string} */
    emoteURL

    constructor(name, url) {
        this.emoteName = name
        this.emoteURL = url
    }
}

class Emotes {
    // #proxyurl = 'https://cors-anywhere.herokuapp.com/';
    #proxyurl = "https://tpbcors.herokuapp.com/";

    /**
     * @type {Array<Emote>}
     */
    emotes = []
    twitchChannelID = null
    
    #channelName = null
    #enable7TV = null

    constructor(channelName, enable7TV) {
        if (!channelName) throw 'Missing required parameter channel name'

        this.#channelName = channelName
        this.#enable7TV = enable7TV
    }
    async init() {
        this.twitchChannelID = await this.#fetchTwitchChannelID(this.#channelName),
        this.#fetchEmotes()
    }
    /**
     * @param {string} channelName
     * @returns {int}
     */
    async #fetchTwitchChannelID(channelName) {
        console.debug(`Fetching Twitch channel ID for channel ${channelName}…`)

        let url = this.#proxyurl + "https://api.ivr.fi/twitch/resolve/" + channelName
        let twitchChannelID = await fetch(url, {
            method: "GET",
            headers: { "User-Agent": "api.roaringiron.com/emoteoverlay" },
        })
        .then(async res => await res.json())
        .then(json => {
            if (json.status != 200) return Promise.reject(`Failed to get Twitch channel ID. Response status code is not 200 OK but ${json.status}`)
            if (json.error) return Promise.reject(`Failed to get Twitch channel ID. Error response: ${json.error}`)

            return json.id
        }, err => Promise.reject(`Failed to fetch Twitch channel ID. Fetch error: ${err}`))
        console.debug(`Identified Twitch channel as ID ${twitchChannelID}`)
        return twitchChannelID
    }
    async #fetchEmotes() {
        console.debug('Fetching emotes…')

        const results = await Promise.allSettled([
            this.#fetchFFZChannel(),
            this.#fetchFFZGlobal(),
            this.#fetchBTTVChannel(),
            this.#fetchBTTVGlobal(),
            this.#fetch7TVChannel(),
            this.#fetch7TVGlobal(),
        ])
        const failed = []
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                const emotes = result.value
                this.emotes.push(...emotes)
            } else {
                failed.push(result.reason)
            }
        })
        const msg = `Successfully loaded ${this.emotes.length} emotes.`
        console.info(msg)
        $("#errors").text(msg).delay(2000).fadeOut(300);
        if (failed.length > 0) {
            console.error('Failed to fetch emotes', ...failed)
            $("#errors").text(failed.join("<br />")).delay(5000).fadeOut(300);
        }
    }
    async #fetchFFZChannel() {
        const response = await fetch(this.#proxyurl + "https://api.frankerfacez.com/v1/room/" + this.#channelName, {
            method: "GET",
        })

        const json = await await response.json()
        if (json.error) return Promise.reject(`Failed to get FFZ Channel emotes. Error response: ${json.error}`)

        let result = []
        const emoteSets = json.sets
        const setName = Object.keys(emoteSets)
        for (var k = 0; k < setName.length; ++k) {
            let key = setName[k]

            const emotes = emoteSets[key].emoticons
            for (var i = 0; i < emotes.length; ++i) {
                const emote = emotes[i]

                const emoteURL = emote.urls["2"] ? emote.urls["2"] : emote.urls["1"]
                const httpsURL = "https://" + emoteURL.split("//").pop()
                result.push(new Emote(emote.name, httpsURL))
            }
        }
        console.debug(`Identified ${result.length} FFZ Channel emotes`)
        return result
    }
    #fetchFFZGlobal() {
        return fetch(this.#proxyurl + "https://api.frankerfacez.com/v1/set/global", {
            method: "GET",
        })
        .then(async res => await res.json())
        .then(json => {
            if (json.error) return Promise.reject(`Failed to get FFZ Global emotes. Error response: ${json.error}`)

            let res = []

            const emoteSets = json.sets
            const setName = Object.keys(emoteSets)
            for (var k = 0; k < setName.length; ++k) {
                const key = setName[k]

                const emotes = emoteSets[key].emoticons
                for (var i = 0; i < emotes.length; ++i) {
                    const emote = emotes[i]

                    const emoteURL = emotes[i].urls["2"] ? emotes[i].urls["2"] : emotes[i].urls["1"];
                    const httpsURL = "https://" + emoteURL.split("//").pop()
                    res.push(new Emote(emote.name, httpsURL))
                }
            }

        console.debug(`Identified ${res.length} FFZ Global emotes`)
            return res
        })
    }
    #fetchBTTVChannel() {
        return fetch(this.#proxyurl + "https://api.betterttv.net/3/cached/users/twitch/" + this.twitchChannelID, {
            method: "GET",
        })
        .then(async res => await res.json())
        .then(json => {
            if (json.error) return Promise.reject(`Failed to get BTTV Channel emotes. Error response: ${json.error}`)

            let res = []

            for (var i = 0; i < json.channelEmotes.length; ++i) {
                const emote = json.channelEmotes[i]

                res.push({
                    emoteName: emote.code,
                    emoteURL: `https://cdn.betterttv.net/emote/${emote.id}/2x`,
                });
            }
            for (var i = 0; i < json.sharedEmotes.length; ++i) {
                let emote = json.sharedEmotes[i]

                res.push(new Emote(emote.code, `https://cdn.betterttv.net/emote/${emote.id}/2x`))
            }

            console.debug(`Identified ${res.length} BTTV Channel emotes`)
            return res
        })
    }
    #fetchBTTVGlobal() {
        return fetch(this.#proxyurl + "https://api.betterttv.net/3/cached/emotes/global", {
            method: "GET",
        })
        .then(async res => await res.json())
        .then(json => {
            if (json.error) return Promise.reject(`Failed to get BTTV Global emotes. Error response: ${json.error}`)
            if (json.message) return Promise.reject(`Failed to get BTTV Global emotes. Message: ${json.message}`)

            let res = []

            for (var i = 0; i < json.length; i++) {
                let emote = json[i]

                res.push(new Emote(emote.code, `https://cdn.betterttv.net/emote/${emote.id}/2x`))
            }

            console.debug(`Identified ${res.length} BTTV Global emotes`)
            return res
        })
    }
    /**
     * @returns {Array<Emote>}
     */
    #fetch7TVChannel() {
        if (!this.#enable7TV) return Promise.resolve([])

        return fetch(this.#proxyurl + `https://api.7tv.app/v2/users/${this.#channelName}/emotes`, {
            method: "GET",
        })
        .then(async res => await res.json())
        .then(json => {
            if (json.status !== 200) return Promise.reject(`Failed to get 7TV Channel emotes. Error response: ${json.error}`)
            if (json.error) return Promise.reject(`Failed to get 7TV Channel emotes. Error response: ${json.error}`)

            let res = []

            for (var i = 0; i < json.length; ++i) {
                let emote = json[i]

                res.push(new Emote(emote.name, emote.urls[1][1]))
            }

            console.debug(`Identified ${res.length} 7TV Channel emotes`)
            return res
        })
    }
    #fetch7TVGlobal() {
        if (!this.#enable7TV) return Promise.resolve([])

        return fetch(this.#proxyurl + `https://api.7tv.app/v2/emotes/global`, {
            method: "GET",
        })
        .then(async res => await res.json())
        .then(json => {
            if (json.status !== 200) return Promise.reject(`Failed to get 7TV Channel emotes. Error response: ${json.error}`)
            if (json.error) return Promise.reject(`Failed to get 7TV Channel emotes. Error response: ${json.error}`)

            let res = []

            for (var i = 0; i < json.length; ++i) {
                let emote = json[i]

                res.push(new Emote(emote.name, emote.urls[1][1]))
            }

            console.debug(`Identified ${res.length} 7TV Global emotes`)
            return res
        })
    }
    /**
     * 
     * @param {Array<string>} words
     * @returns {Emote?}
     */
    findFirstEmoteInMessage(words) {
        for (const emote of this.emotes) {
            if (words.includes(emote.emoteName)) {
                return emote
            }
        }
        return null
    }
}

class Display {
    /**
     * @type {Settings}
     */
    #settings = null

    /**
     * @type {Emotes}
     */
    #emotes = null

    /** @type {Date} */
    #showEmoteCooldownRef = new Date()

    /**
     * @param {Settings} settings
     * @param {Emotes} emotes 
     */
    constructor(settings, emotes) {
        this.#settings = settings
        this.#emotes = emotes
    }

    /**
     * @param {string} messageText 
     * @param {*} messageFull 
     * @returns {void}
     */
    showEmote(messageText, messageFull) {
        if (!this.#settings.showEmoteEnabled) return

        const msgEmotesDataIndex = messageFull[4].startsWith("emotes=") ? 4 : 5;
        const emotesData = messageFull[msgEmotesDataIndex]
        const emoteUsedIDs = emotesData.split("emotes=").pop();
        // Twitch emote from msg data field
        if (emoteUsedIDs.length > 0) {
            const emoteDataSplit = emoteUsedIDs.split(":")
            const emoteID = emoteDataSplit[0]
            // 'x-y'
            const substrRange = emoteDataSplit[1]
            const substrIndex = substrRange.split("-")
            const from = parseInt(substrIndex[0])
            const to = parseInt(substrIndex[1])
            const emoteName = messageText.substring(from, to + 1)

            const emoteLink = `https://static-cdn.jtvnw.net/emoticons/v2/${emoteID}/default/dark/2.0`;
            return this.#showEmoteEvent(new Emote(emoteName, emoteLink))
        }

        let words = messageText.split(" ")
        let firstEmote = this.#emotes.findFirstEmoteInMessage(words)
        if (firstEmote !== null) {
            return this.#showEmoteEvent(new Emote(firstEmote.emoteName, firstEmote.emoteURL))
        }
    }
    /**
     * @param {Emote} emote 
     */
    #showEmoteEvent(emote) {
        let secondsDiff = (new Date().getTime() - new Date(this.#showEmoteCooldownRef).getTime()) / 1000;
        console.debug(`showEmote command time since last invocation: ${secondsDiff}s`)

        const cooldown = parseInt(this.#settings.showEmoteCooldown)
        if (cooldown > secondsDiff) return
        this.#showEmoteCooldownRef = new Date();

        this.#createImage(emote)
    }
    /**
     * @param {Emote} emote 
     */
    #createImage(emote) {
        const emoteDomEl = document.getElementById('showEmote')
        const emoteEl = $("#showEmote")

        emoteDomEl.innerText = ''

        const max_height = document.body.offsetHeight
        const max_width = document.body.offsetWidth

        let x = Math.floor(Math.random() * max_width)
        let y = Math.floor(Math.random() * max_height)
        emoteEl.css("position", "absolute")
        if (x < max_width / 2) {
            emoteEl.css("left", x + "px")
        } else {
            emoteEl.css("right", (max_width - x) + "px")
        }
        if (x < max_width / 2) {
            emoteEl.css("top", y + "px")
        } else {
            emoteEl.css("bottom", (max_height - y) + "px")
        }

        console.debug(`creating showEmote ${emote.emoteName}`)
        const img = $("<img />", { 
            src: emote.emoteURL,
            style: `transform: scale(${this.#settings.showEmoteSizeMultiplier}, ${this.#settings.showEmoteSizeMultiplier})`
         })
        img.appendTo("#showEmote")

        emoteDomEl.classList.add('visible')
        setTimeout(() => emoteDomEl.classList.remove('visible'), 5000)
    }
}

class StreakTracker {
    /** @type {Settings} */
    #settings = null

    /** @type {Emotes} */
    #emotes

    constructor(settings, emotes) {
        this.#settings = settings
        this.#emotes = emotes

        // the current emote streak being used in chat
        this.currentStreak = { streak: 1, emote: null, emoteURL: null }
        // the current emote being used in chat
        this.currentEmote
        this.streakCD = new Date().getTime();
    }

    findEmoteStreaks(messageText, messageData) {
        const words = messageText.split(" ");
        // Matches current streak
        if (words.includes(this.currentStreak.emote)) {
            this.currentStreak.streak++
            this.streakEvent()
            return
        }

        const emoteDataIndex = messageData[4].startsWith("emotes=") ? 4 : messageData[5].startsWith("emote-only=") ? 6 : 5;
        const emoteData = messageData[emoteDataIndex].split("emotes=").pop();
        // New streak from twitch message twitch emote data
        if (emoteData.length > 1) {
            const idAndIndex = emoteData.split(":")
            const emoteID = idAndIndex[0]
            const index = idAndIndex[1].split('-')
            const from = parseInt(index[0])
            const to = parseInt(index[1])
            const emoteName = messageText.substring(from, to + 1)
            const emoteURL = `https://static-cdn.jtvnw.net/emoticons/v2/${emoteID}/default/dark/2.0`

            this.currentStreak = { streak: 1, emote: emoteName, emoteURL: emoteURL }
            this.streakEvent()
            return
        }

        // find emotes from text
        const emote = this.#emotes.findFirstEmoteInMessage(words)
        if (emote === null) return
        this.currentStreak = { streak: 1, emote: emote.emoteName, emoteURL: emote.emoteURL }
        this.streakEvent()
        return
    }
    streakEvent() {
        if (!this.#settings.streakEnabled) return
        if (this.currentStreak.streak < this.#settings.minStreak) return

        console.debug(`Streak event with a ${this.currentStreak.streak} streak`)
        $("#main").empty();

        $("#main").css("position", "absolute");
        //$("#main").css("left", "35"); // 35
        //$("#main").css("bottom", "35"); // 70
        const img = $("<img />", { src: this.currentStreak.emoteURL })
        img.appendTo("#main")

        const streakLength = $("#main").append(" 󠀀  󠀀  x" + currentStreak.streak + " streak!")
        streakLength.appendTo("#main")

        gsap.to("#main", 0.2, {
            scaleX: 1.2,
            scaleY: 1.2,
            onComplete: () => { gsap.to("#main", 0.15, { scaleX: 1, scaleY: 1 }) }
        })

        this.streakCD = new Date().getTime()

        // FIXME: This will start multiple intervals on successive streak increases
        // Initiate continuous streak display until it subsides
        const intervalID = setInterval(this.streakTick.bind(this), 1 * 1000, () => clearInterval(intervalID))
    }
    streakTick(clearCallback) {
        const timeMS = new Date().getTime()
        const diff = timeMS - this.streakCD
        if (diff > 4 * 1000) {
            console.debug('Hiding streak display')

            // TODO: Useless time setting?
            this.streakCD = new Date().getTime()

            // Initiate hide animation
            gsap.to("#main", 0.2, { x: 0, y: 0, scaleX: 0, scaleY: 0, delay: 0.5, onComplete: () => { this.streakCD = new Date().getTime() } });
            clearCallback()
        }
    }
}

class ChatClient {
    /**
     * @type {Settings}
     */
    #settings = null

    /**
     * @type {WebSocket}
     */
    #websocket = null

    /**
     * @type {Display}
     */
    #display = null

    /** @type {StreakTracker} */
    #streakTracker = null

    /**
     * @param {Settings} settings 
     * @param {Display} display
     * @param {StreakTracker} streakTracker
     */
    constructor(settings, display, streakTracker) {
        this.#settings = settings
        this.#display = display
        this.#streakTracker = streakTracker
    }

    connect() {
        this.#websocket = new WebSocket("wss://irc-ws.chat.twitch.tv")
        this.#websocket.addEventListener('open', this.onOpen.bind(this))
        this.#websocket.addEventListener('close', this.onClose.bind(this))
        this.#websocket.addEventListener('error', this.onError.bind(this))
        this.#websocket.addEventListener('message', this.onMessage.bind(this))
    }
    /**
     * @this {ChatClient}
     * @param {Event} event 
     */
    onOpen() {
        this.#websocket.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership")
        this.#websocket.send("PASS oauth:xd123")
        this.#websocket.send("NICK justinfan123")
        this.#websocket.send("JOIN #" + this.#settings.channel)
    }
    /**
     * @param {CloseEvent} event 
     */
    onClose(event) {
        console.debug('ChatClient: Closed connection')
    }
    /**
     * @this {ChatClient}
     * @param {Event} event 
     */
    onError(event) {
        console.error(`ChatClient: Websocket error. Trying to close and reconnect.`, event)
        this.#websocket.close()
        this.#websocket.connect()
    }
    /**
     * @this {ChatClient}
     * @param {MessageEvent<any>} event 
     */
    onMessage(event) {
        /**@type {string} */
        const firstLine = event.data.split(/\r\n/)[0]
        const msgData = firstLine.split(`;`)
        console.debug('ChatClient: onMessage', msgData)

        if (msgData.length == 1 && msgData[0].startsWith('PING')) {
            console.debug('Sending PING response PONG…')
            this.#websocket.send("PONG")
            return
        }

        if (msgData.length > 12) {
            // The data array object has numerous items
            // badges, clientnonce, color, displayname, emotes, firstmsg, flags, id, mod, roomid, subscriber, senttimestamp, turbo, userid
            // , 'usertype= :username!username@username.tmi.twitch.tv PRIVMSG #channelname :textmsg'
            const lastPart = msgData[msgData.length - 1]
            // drop channel name prefix
            let messageText = lastPart.split(`#${this.#settings.channel} :`).pop()

            // checks for the /me ACTION usage and gets the specific message
            if (messageText.split(" ").includes("ACTION")) {
                messageText = messageText.split("ACTION ").pop().split("")[0]
            }
            this.#onChatMessage(messageText, msgData);
        }
    }
    #onChatMessage(messageText, messageFull) {
        if (this.#startsWithShowEmoteCommand(messageText)) {
            this.#display.showEmote(messageText, messageFull);
        }

        this.#streakTracker.findEmoteStreaks(messageText, messageFull);
    }
    #startsWithShowEmoteCommand(messageText) {
        const lower = messageText.toLowerCase()
        for (let i = 0; i < this.#settings.showEmoteCommands.length; ++i) {
            let cmd = this.#settings.showEmoteCommands[i]
            if (lower.startsWith(cmd)) {
                return true
            }
        }
        return false
    }
}

(async () => {
    let settings = new Settings()
    let logger = new Logger(settings.debug)

    console.info(`Using channel ${settings.channel}`, settings)
    console.info(`The streak module is ${settings.streakEnabled} and the showEmote module is ${settings.showEmoteEnabled}`);

    let emotes = new Emotes(settings.channel)
    await emotes.init()

    let display = new Display(settings, emotes)
    let streakTracker = new StreakTracker(settings, emotes)

    let chat = new ChatClient(settings, display, streakTracker)
    setTimeout(() => {
        chat.connect()
    }, 10 * 1000)
})()

