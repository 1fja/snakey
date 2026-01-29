let socket
let roomID = null

let myPublicKey
let myPrivateKey
let peerPublicKey = null

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

  return openpgp.readPrivateKey({
    armoredKey: keys.privateKey
  })
})
.then(priv => {
  myPrivateKey = priv
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
  if (!roomID) {
    roomID = prompt("Paste room ID")
    if (!roomID) return
  }

  socket = new WebSocket("ws://localhost:8080/ws?room=" + roomID)

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
    }
  }
}

/* =====================
   SEND MESSAGE
===================== */

function sendMsg() {
  if (!peerPublicKey) {
    alert("Waiting for peer key")
    return
  }

  const input = document.getElementById("msg")
  const text = input.value
  input.value = ""

  // PADDING REAL
  const padSize = Math.floor(Math.random() * 200) + 50
  const padding = " ".repeat(padSize)
  const paddedText = text + "::PAD::" + padding

  openpgp.createMessage({ text: paddedText })
    .then(msg => {
      return openpgp.encrypt({
        message: msg,
        encryptionKeys: peerPublicKey
      })
    })
    .then(encrypted => {

      // DELAY JITTER
      const jitter = Math.floor(Math.random() * 400) + 100

      setTimeout(() => {
        socket.send(JSON.stringify({
          type: "msg",
          data: encrypted
        }))
      }, jitter)

      addMsg("You: " + text)
    })
}

/* =====================
   FAKE TRAFFIC
===================== */
function generateFakePGP() {
  const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

  function randBase64(len) {
    let out = ""
    for (let i = 0; i < len; i++) {
      out += base64Chars.charAt(Math.floor(Math.random() * base64Chars.length))
    }
    return out
  }

  const lines = Math.floor(Math.random() * 10) + 8
  let body = ""

  for (let i = 0; i < lines; i++) {
    body += randBase64(64) + "\n"
  }

  return (
`-----BEGIN PGP MESSAGE-----
Version: OpenPGP

${body}-----END PGP MESSAGE-----`
  )
}


function sendFake() {
  if (!socket || socket.readyState !== 1) return

  const PGP = generateFakePGP()

  const jitter = Math.floor(Math.random() * 800) + 200

  setTimeout(() => {
    socket.send(JSON.stringify({
      type: "msg",
      data: PGP
    }))
  }, jitter)
}


setInterval(function () {
  sendFake()
}, Math.random() * 3000 + 2000)

/* =====================
   UI
===================== */

function addMsg(text) {
  const div = document.createElement("div")
  div.textContent = text
  document.getElementById("messages").appendChild(div)
}

/* =====================
   MEMORY WIPE + DESTROY KEYS
===================== */

function wipe(obj) {
  if (!obj) return
  for (let k in obj) {
    try {
      obj[k] = Math.random().toString(36)
    } catch {}
  }
}

window.addEventListener("beforeunload", function () {
  wipe(myPrivateKey)
  wipe(myPublicKey)
  wipe(peerPublicKey)

  myPrivateKey = null
  myPublicKey = null
  peerPublicKey = null
  socket = null
})
const protocol = location.protocol === "https:" ? "wss://" : "ws://"
socket = new WebSocket(protocol + location.host + "/ws?room=" + roomID)
