'use strict'

document.getElementById('debug').innerText = 'test'
console.info = (text) => { document.getElementById('debug').innerText = text}
console.error = (text) => { document.getElementById('debug').innerText = text }
console.debug = (text) => {
    document.getElementById('debug').innerText = text
}

class Settings {
    showEmoteCommands: Array<string> = ['!showemote', '!#showemote', '!showe', '!show', '!s']
    channel: string

    streakEnabled: boolean
    minStreak: number

    showEmoteEnabled: boolean
    showEmoteSizeMultiplier: number
    showEmoteCooldown: number

    sevenTVEnabled: boolean
    debug: boolean

    constructor() {
        this.parseFromURL()
        this.validate()
        console.debug('Using settings', this)
    }
    parseFromURL(): void {
        let params = new URL(document.location.href).searchParams

        this.channel = params.get("channel")?.toLowerCase()

        // show emote streaks
        this.streakEnabled = !params.has("streakEnabled") || params.get('streakEnabled') != '0'
        this.minStreak = parseInt(params.get("minStreak") ?? '5')

        // enable show emote command
        this.showEmoteEnabled = !params.has("showEmoteEnabled") || params.get("showEmoteEnabled") != '0'
        this.showEmoteSizeMultiplier = parseFloat(params.get("showEmoteSizeMultiplier") ?? '1.0')
        this.showEmoteCooldown = parseFloat(params.get("showEmoteCooldown") ?? '6.0')

        this.sevenTVEnabled = !params.has("7tv") || params.get("7tv") != '0'

        this.debug = params.has("debug")
    }
    validate(): void {
        if (this.channel === null) throw 'Missing required `channel` configuration'
    }
}

class Emote {
    emoteName: string
    emoteURL: string

    constructor(name: any, url: string) {
        this.emoteName = name
        this.emoteURL = url
    }
}

class Emotes {
    // #proxyurl = 'https://cors-anywhere.herokuapp.com/';
    #proxyurl = "https://tpbcors.herokuapp.com/";

    emotes: Array<Emote> = []
    twitchChannelID: number | null = null

    #channelName: string
    #enable7TV: boolean

    constructor(channelName: string, enable7TV: boolean) {
        if (!channelName) throw 'Missing required parameter channel name'
        if (!enable7TV) throw 'Missing required parameter enable7TV'

        this.#channelName = channelName
        this.#enable7TV = enable7TV
    }
    async init() {
        this.twitchChannelID = await this.#fetchTwitchChannelID(this.#channelName),
        this.#fetchEmotes()
    }
    async #fetchTwitchChannelID(channelName: string): Promise<number> {
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
    async #fetchFFZChannel(): Promise<Array<Emote>> {
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
    #fetchFFZGlobal(): Promise<Array<Emote>> {
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
    #fetchBTTVChannel(): Promise<Array<Emote>> {
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
    #fetchBTTVGlobal(): Promise<Array<Emote>> {
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
    #fetch7TVChannel(): Promise<Array<Emote>> {
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
    #fetch7TVGlobal(): Promise<Array<Emote>> {
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
    findFirstEmoteInMessage(words: string | any[]): Emote | null {
        for (const emote of this.emotes) {
            if (words.includes(emote.emoteName)) {
                return emote
            }
        }
        return null
    }
}

class EmoteShower {
    #settings: Settings
    #emotes: Emotes = null
    #showEmoteCooldownRef: Date = new Date()

    constructor(settings: Settings, emotes: Emotes) {
        this.#settings = settings
        this.#emotes = emotes
    }

    showEmote(messageText: string, messageFull: string[]): void {
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
    #showEmoteEvent(emote: Emote) {
        const cooldown = this.#settings.showEmoteCooldown
        let secondsDiff = (new Date().getTime() - this.#showEmoteCooldownRef.getTime()) / 1000;
        console.debug(`showEmote command time since last invocation: ${secondsDiff}s (cooldown ${cooldown})`)
        if (cooldown > secondsDiff) return

        this.#showEmoteCooldownRef = new Date();

        this.#createImage(emote)
    }
    #createImage(emote: Emote) {
        console.debug(`creating showEmote for ${emote.emoteName}…`)
        const minMargin = 8
        const transitionDurationS = 1
        const visibleDuration = 5000
        const emoteDomEl = document.createElement('img')
        emoteDomEl.classList.add('showEmote')
        emoteDomEl.src = emote.emoteURL
        emoteDomEl.style.transform = `scale(${this.#settings.showEmoteSizeMultiplier}, ${this.#settings.showEmoteSizeMultiplier})`
        emoteDomEl.style.transition = `transition: opacity ${transitionDurationS}s ease-in-out`
        document.body.appendChild(emoteDomEl)

        const max_height = document.body.offsetHeight - 2 * minMargin
        const max_width = document.body.offsetWidth - 2 * minMargin

        let x = minMargin + Math.floor(Math.random() * max_width)
        let y = minMargin + Math.floor(Math.random() * max_height)
        if (x < max_width / 2) {
            emoteDomEl.style.left = `${x}px`
        } else {
            emoteDomEl.style.right = `${max_width - x}px`
        }
        if (x < max_width / 2) {
            emoteDomEl.style.top = `${y}px`
        } else {
            emoteDomEl.style.bottom = `${max_height - y}px`
        }

        emoteDomEl.classList.add('visible')
        setTimeout(() => emoteDomEl.classList.remove('visible'), visibleDuration)
        setTimeout(() => emoteDomEl.remove(), visibleDuration + 3 * transitionDurationS * 1000)
    }
}

class StreakData {
    streak: number
    emote: string
    emoteURL: string
}
class StreakTracker {
    #settings: Settings = null
    #emotes: Emotes

    currentStreak: StreakData = new StreakData()
    streakCD: number

    constructor(settings: Settings, emotes: Emotes) {
        this.#settings = settings
        this.#emotes = emotes

        // the current emote streak being used in chat
        this.currentStreak = { streak: 1, emote: null, emoteURL: null }
        this.streakCD = new Date().getTime();
    }

    findEmoteStreaks(messageText: string, messageData: string[]): void {
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
    streakEvent(): void {
        if (!this.#settings.streakEnabled) return
        if (this.currentStreak.streak < this.#settings.minStreak) return

        console.debug(`Streak event with a ${this.currentStreak.streak} streak`)
        const domEl = document.getElementById('main')
        domEl.innerText = ''

        const imgEl = document.createElement('img')
        imgEl.src = this.currentStreak.emoteURL
        domEl.appendChild(imgEl)

        const text = ` 󠀀  󠀀  x ${this.currentStreak.streak} streak!`

        domEl.innerHTML += text

        //$("#main").css("left", "35"); // 35
        //$("#main").css("bottom", "35"); // 70

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
    streakTick(clearCallback: () => void): void {
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
    #settings: Settings
    #websocket: WebSocket = null
    #display: EmoteShower = null
    #streakTracker: StreakTracker = null

    constructor(settings: Settings, display: EmoteShower, streakTracker: StreakTracker) {
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
    /** @this {ChatClient} */
    onOpen(event: Event): void {
        this.#websocket.send("CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership")
        this.#websocket.send("PASS oauth:xd123")
        this.#websocket.send("NICK justinfan123")
        this.#websocket.send("JOIN #" + this.#settings.channel)
    }
    /** @this {ChatClient} */
    onClose(event: CloseEvent) {
        console.debug('ChatClient: Closed connection')
    }
    /** @this {ChatClient} */
    onError(event: Event) {
        console.error(`ChatClient: Websocket error. Trying to close and reconnect.`, event)
        this.#websocket.close()
        this.#websocket.connect()
    }
    /** @this {ChatClient} */
    onMessage(event: MessageEvent<any>) {
        const firstLine: string = event.data.split(/\r\n/)[0]
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
            this.#onChatMessage(messageText, msgData)
        }
    }
    #onChatMessage(messageText: string, messageFull: Array<string>) {
        if (this.#startsWithShowEmoteCommand(messageText)) {
            this.#display.showEmote(messageText, messageFull);
        }

        this.#streakTracker.findEmoteStreaks(messageText, messageFull);
    }
    #startsWithShowEmoteCommand(messageText: string) {
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

    console.info(`Using channel ${settings.channel}`, settings)
    console.info(`The streak module is ${settings.streakEnabled} and the showEmote module is ${settings.showEmoteEnabled}`);

    let emotes = new Emotes(settings.channel, settings.sevenTVEnabled)
    await emotes.init()

    let display = new EmoteShower(settings, emotes)
    let streakTracker = new StreakTracker(settings, emotes)

    let chat = new ChatClient(settings, display, streakTracker)
    setTimeout(() => {
        chat.connect()
    }, 10 * 1000)
})()
