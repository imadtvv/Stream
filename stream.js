const axios = require("axios");
const { Worker, isMainThread, workerData } = require("worker_threads");

const GRAPH_VERSION = "v23.0";

// ===================== TOKENS & CONFIG =====================
const LIVE_ACCESS_TOKEN = "EAAXFmoOwcroBRJ413I19SV8Ao9CytyvjemSgZCtlG4KNAKhZAxBqryrkkVZBoC36ZBNCY1cHirrHWp7jayUPL9zIMYMOQbzWt5EaZCZAnKzGxnUYywRBuOIcLZCPKf55goav2EatP0Agap62dYerBLZCfWjiP2ZBZC8a20lRUClDSTYtLUJHxXZB5MOZCXl24RmHZClTKLOvLWZBuv";
const LIVE_PAGE_ID = "882313624971208"; 

const POST_ACCESS_TOKEN = "EAAUtvuNmD54BQZBsxuuZABDiiiDyz3inKwrMRNlB8jlcGYaHdi8R3yaj7TXm3po74GVcPRhuChMzJNiZCnvKJvx0kJYhfGjTV4rImJ6ysxCCkFymPgn2muhGiPxrI59hJUevlP2ZAZCmglwngDWAs1G0dF7lZCusKwv9rr7ZCgd5YpXWuHhNjuZBIoUOA2FeIBCLLCHH";
const POST_PAGE_ID = "941509759050822";
const POST_ID = "122112320883236761";

// ===================== CHANNELS LIST =====================
const CHANNELS = [
    { name: "beIN 1", url: "http://dhoomtv.xyz/8zpo3GsVY7/beneficial2concern/652350", img: "gdgr" },
    { name: "beIN 2", url: "http://dhoomtv.xyz/8zpo3GsVY7/beneficial2concern/652351", img: "gdgr" },
    { name: "beIN 3", url: "http://dhoomtv.xyz/8zpo3GsVY7/beneficial2concern/652352", img: "gdgr" },
    { name: "beIN 4", url: "http://dhoomtv.xyz/8zpo3GsVY7/beneficial2concern/652353", img: "gdgr" },
    { name: "beIN 5", url: "http://dhoomtv.xyz/8zpo3GsVY7/beneficial2concern/652354", img: "gdgr" },
    { name: "beIN 6", url: "http://dhoomtv.xyz/8zpo3GsVY7/beneficial2concern/652355", img: "gdgr" },
    { name: "beIN 7", url: "http://dhoomtv.xyz/8zpo3GsVY7/beneficial2concern/652356", img: "gdgr" },
    { name: "beIN 8", url: "http://dhoomtv.xyz/8zpo3GsVY7/beneficial2concern/652357", img: "gdgr" },
    { name: "beIN 9", url: "http://dhoomtv.xyz/8zpo3GsVY7/beneficial2concern/652358", img: "gdgr" },
    { name: "2M", url: "https://stream-lb.livemediama.com/2m/hls/stream_2/playlist.m3u8", img: "gdgr" },
    { name: "Al Aoula", url: "https://stream-lb.livemediama.com/alaoula/hls/stream_2/playlist.m3u8", img: "gdgr" },
    { name: "Arryadia HD", url: "https://stream-lb.livemediama.com/arryadia/hls/stream_2/playlist.m3u8", img: "gdgr" }
];

if (!isMainThread) {
    const { spawn } = require("child_process");
    const { url, rtmp } = workerData;

    // استخدام صيغة FFmpeg البسيطة (Simple Copy) لضمان السرعة وعدم الاستقلال
    const ffmpeg = spawn("ffmpeg", [
        "-re", 
        "-i", url,
        "-vcodec", "copy", 
        "-acodec", "copy",
        "-f", "flv",
        rtmp
    ]);

    ffmpeg.on("exit", (code) => process.exit(code || 1));
} else {
    let streamKeys = [];
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    async function createLive(channel) {
        try {
            const res = await axios.post(`https://graph.facebook.com/${GRAPH_VERSION}/${LIVE_PAGE_ID}/live_videos`, null, 
            { params: { access_token: LIVE_ACCESS_TOKEN, status: "UNPUBLISHED", title: channel.name } });
            console.log(`📡 [CONSOL]: Initiating ${channel.name}...`);
            return { ...channel, ...res.data };
        } catch (e) { 
            console.log(`❌ [CONSOL ERROR]: ${channel.name} failed to create.`);
            return null; 
        }
    }

    async function updatePost() {
        try {
            const payload = streamKeys.map(s => ({
                img: s.img,
                name: s.dash ? `${s.name} ✅` : `${s.name} ❌`,
                url: s.dash || "Offline"
            }));
            await axios.post(`https://graph.facebook.com/${POST_PAGE_ID}_${POST_ID}`, null, 
            { params: { access_token: POST_ACCESS_TOKEN, message: JSON.stringify(payload) } });
            console.log("📢 [CONSOL]: Facebook Post Updated.");
        } catch (e) { console.log("❌ [CONSOL]: Post update failed."); }
    }

    async function startNewSession() {
        streamKeys = [];
        console.log("🚀 [CONSOL]: Starting ALL channels simultaneously NOW (Glitch Mode)...");
        
        // إطلاق جميع القنوات في نفس الوقت تماماً باستخدام Promise.all
        const results = await Promise.all(CHANNELS.map(ch => createLive(ch)));
        
        results.forEach(res => {
            if (res && res.stream_url) {
                const info = { name: res.name, url: res.url, img: res.img, rtmp: res.stream_url, id: res.id, dash: null };
                streamKeys.push(info);
                
                // تشغيل العامل فوراً لكل قناة بدون تأخير
                new Worker(__filename, { workerData: info });
            }
        });

        console.log("⏳ [CONSOL]: Success. Waiting 2 minutes for Dash links & Post update...");
        await sleep(120000); 
        
        for (let s of streamKeys) {
            try {
                const r = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${s.id}?fields=dash_preview_url&access_token=${LIVE_ACCESS_TOKEN}`);
                s.dash = r.data.dash_preview_url;
                if (s.dash) {
                    console.log(`✅ [CONSOL]: ${s.name} is ONLINE`);
                } else {
                    console.log(`❌ [CONSOL]: ${s.name} is OFFLINE (No DASH)`);
                }
            } catch { s.dash = null; }
        }

        await updatePost();

        console.log("🕒 [CONSOL]: System running. Next full restart in 3h 55m.");
        await sleep((3 * 60 + 55) * 60 * 1000); 
        
        startNewSession();
    }

    startNewSession();
}
