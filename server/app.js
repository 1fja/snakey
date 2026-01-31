let socket = null
let roomID = null

let myPublicKey = null
let myPrivateKey = null
let peerPublicKey = null
let keysReady = false

/* =====================
   KEY GENERATION
===================== */

openpgp.generateKey({
  type: "rsa",
  rsaBits: 2048,
  userIDs: [{ name: "anon" }]
})
.then(keys => {
  myPublicKey = keys.publicKey
  return openpgp.readPrivateKey({ armoredKey: keys.privateKey })
})
.then(priv => {
  myPrivateKey = priv
  keysReady = true
})

/* =====================
   INVITE
===================== */

function openInvite() {
  window.open(location.origin + "/pair/create", "_blank")
  alert("Copy the room ID and paste it when connecting")
}

/* =====================
   CONNECT
===================== */

function connectPeer() {
  if (!keysReady) {
    alert("Wait keys generation")
    return
  }

  if (!roomID) {
    roomID = prompt("Paste room ID")
    if (!roomID) return
  }

  const protocol = location.protocol === "https:" ? "wss://" : "ws://"
  socket = new WebSocket(protocol + location.host + "/ws?room=" + roomID)

  socket.onopen = function () {
    socket.send(JSON.stringify({
      type: "key",
      key: myPublicKey
    }))
  }

  socket.onmessage = function (e) {
    const msg = JSON.parse(e.data)

    if (msg.type === "peer-key") {
      openpgp.readKey({ armoredKey: msg.key })
        .then(k => {
          peerPublicKey = k
          document.getElementById("status").innerText = "Connected"
          document.getElementById("chat").style.display = "block"
        })
      return
    }

    if (msg.type === "msg") {
      openpgp.readMessage({ armoredMessage: msg.data })
        .then(m => {
          return openpgp.decrypt({
            message: m,
            decryptionKeys: myPrivateKey
          })
        })
        .then(res => {
          const clean = res.data.split("::PAD::")[0]
          addMsg("Peer: " + clean)
        })
        .catch(() => {})
    }
  }

  socket.onclose = function () {
    document.getElementById("status").innerText = "Disconnected"
  }
}

/* =====================
   SEND MESSAGE
===================== */

function sendMsg() {
  if (!peerPublicKey) {
    alert("Waiting peer")
    return
  }

  const input = document.getElementById("msg")
  const text = input.value
  if (!text) return
  input.value = ""

  const pad = " ".repeat(Math.floor(Math.random() * 150) + 50)
  const payload = text + "::PAD::" + pad

  openpgp.createMessage({ text: payload })
    .then(msg => {
      return openpgp.encrypt({
        message: msg,
        encryptionKeys: peerPublicKey
      })
    })
    .then(enc => {
      socket.send(JSON.stringify({
        type: "msg",
        data: enc
      }))
      addMsg("You: " + text)
    })
}

/* =====================
   UI
===================== */

function addMsg(text) {
  const div = document.createElement("div")
  div.textContent = text
  document.getElementById("messages").appendChild(div)
}

/* =====================
   CLEANUP
===================== */

window.addEventListener("beforeunload", function () {
  myPrivateKey = null
  myPublicKey = null
  peerPublicKey = null
  socket = null
})
/* =====================
   PASSIVE FAKE TRAFFIC
   (NÃO TOCA NO CHAT REAL)
===================== */

function generateFakePGPMessage() {
  const base = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
  function rand(len) {
    let s = ""
    for (let i = 0; i < len; i++) {
      s += base[Math.floor(Math.random() * base.length)]
    }
    return s
  }

  let body = ""
  const lines = Math.floor(Math.random() * 8) + 6
  for (let i = 0; i < lines; i++) {
    body += rand(64) + "\n"
  }

  return (
`-----BEGIN PGP MESSAGE-----

${body}-----END PGP MESSAGE-----`
  )
}

function sendFakeTraffic() {
  try {
    if (!socket || socket.readyState !== 1) return
    if (!peerPublicKey) return

    const fake = generateFakePGPMessage()
    const jitter = Math.floor(Math.random() * 1200) + 300

    setTimeout(() => {
      try {
        socket.send(JSON.stringify({
          type: "msg",
          data: fake
        }))
      } catch {}
    }, jitter)
  } catch {}
}

/* loop imprevisível */
setInterval(() => {
  if (Math.random() > 0.4) {
    sendFakeTraffic()
  }
}, Math.random() * 4000 + 3000)
