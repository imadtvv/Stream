const axios = require("axios");
const { Worker, isMainThread, workerData } = require("worker_threads");

const GRAPH_VERSION = "v23.0";

// ===================== TOKENS & CONFIG =====================
const LIVE_ACCESS_TOKEN = "EAAXFmoOwcroBRJ413I19SV8Ao9CytyvjemSgZCtlG4KNAKhZAxBqryrkkVZBoC36ZBNCY1cHirrHWp7jayUPL9zIMYMOQbzWt5EaZCZAnKzGxnUYywRBuOIcLZCPKf55goav2EatP0Agap62dYerBLZCfWjiP2ZBZC8a20lRUClDSTYtLUJHxXZB5MOZCXl24RmHZClTKLOvLWZBuv";
const LIVE_PAGE_ID = "882313624971208"; 

const POST_ACCESS_TOKEN = "EAAUtvuNmD54BQZBsxuuZABDiiiDyz3inKwrMRNlB8jlcGYaHdi8R3yaj7TXm3po74GVcPRhuChMzJNiZCnvKJvx0kJYhfGjTV4rImJ6ysxCCkFymPgn2muhGiPxrI59hJUevlP2ZAZCmglwngDWAs1G0dF7lZCusKwv9rr7ZCgd5YpXWuHhNjuZBIoUOA2FeIBCLLCHH";
const POST_PAGE_ID = "941509759050822";
const POST_ID = "122112320883236761";

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
    // البث الفعلي باستخدام copy
    const ffmpeg = spawn("ffmpeg", ["-re", "-i", url, "-vcodec", "copy", "-acodec", "copy", "-f", "flv", rtmp]);
    ffmpeg.on("exit", (code) => process.exit(code || 1));
} else {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    async function prepareChannel(channel) {
        try {
            // خطوة 1: إنشاء البث (Unpublished)
            const res = await axios.post(`https://graph.facebook.com/${GRAPH_VERSION}/${LIVE_PAGE_ID}/live_videos`, null, 
            { params: { access_token: LIVE_ACCESS_TOKEN, status: "UNPUBLISHED", title: channel.name } });
            
            const liveId = res.data.id;
            const rtmpUrl = res.data.stream_url;

            // خطوة 2: الانتظار 5 ثوانٍ ليتولد رابط الـ MPD (DASH)
            console.log(`⏳ [WAIT]: Waiting 5s for ${channel.name} DASH link...`);
            await sleep(5000);

            // خطوة 3: جلب رابط الـ DASH
            const dashRes = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${liveId}?fields=dash_preview_url&access_token=${LIVE_ACCESS_TOKEN}`);
            const dashUrl = dashRes.data.dash_preview_url;

            console.log(`✅ [READY]: ${channel.name} prepared.`);
            return { ...channel, rtmp: rtmpUrl, dash: dashUrl };
        } catch (e) {
            console.log(`❌ [ERROR]: Failed to prepare ${channel.name}`);
            return null;
        }
    }

    async function startFlow() {
        console.log("🚀 [STEP 1]: Starting preparation phase...");
        
        // جلب البيانات لجميع القنوات (واحدة تلو الأخرى لضمان جلب الروابط بدقة)
        let preparedData = [];
        for (let ch of CHANNELS) {
            const data = await prepareChannel(ch);
            if (data) preparedData.push(data);
        }

        console.log("📢 [STEP 2]: Updating Post with ALL DASH links...");
        try {
            const payload = preparedData.map(s => ({
                img: s.img,
                name: `${s.name} ✅`,
                url: s.dash || "Link Pending"
            }));
            await axios.post(`https://graph.facebook.com/${POST_PAGE_ID}_${POST_ID}`, null, 
            { params: { access_token: POST_ACCESS_TOKEN, message: JSON.stringify(payload) } });
            console.log("✅ [CONSOL]: Dashboard updated.");
        } catch (e) { console.log("❌ [CONSOL]: Update failed."); }

        // خطوة 4: الانتظار دقيقة كاملة قبل الإطلاق الفعلي
        console.log("⏳ [WAIT]: Final cooldown for 1 minute before MASS LAUNCH...");
        await sleep(60000);

        console.log("🔥 [STEP 3]: MASS LAUNCH! Starting all FFmpeg processes now...");
        preparedData.forEach(data => {
            new Worker(__filename, { 
                workerData: { url: data.url, rtmp: data.rtmp } 
            });
        });

        console.log("🕒 [SYSTEM]: All streams active. Restart cycle in 3h 55m.");
        setTimeout(startFlow, (3 * 60 + 55) * 60 * 1000);
    }

    startFlow();
}
