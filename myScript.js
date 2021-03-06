  function noop() {}

    function insertToPage(id, text) {
        var li = document.createElement('li');
        li.innerText = text;
        document.getElementById(id).appendChild(li);
    }

    function find() {
        // regular expressions used
        var regex = {
            /**
             * ip detection. IPv4 / IPv6.
             */
            ip: /[0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(?::[a-f0-9]{1,4}){7}/,
            /**
             * candidate type detection.
             *
             * types:
             * - host: host addr (NAT translated inbound addr)
             * - srflx: server reflexive addr (NAT translated outbound addr)
             * - prflx: peer reflexive addr
             * - relay: relay addr (TURN server allocated relay addr)
             *
             */
            can_type: /typ (host|srflx|prflx|relay)/
        };

        var ips = {};

        var RTCPeerConnection = window.RTCPeerConnection
                || window.mozRTCPeerConnection
                || window.webkitRTCPeerConnection;
        //bypass naive webrtc blocking using an iframe
        if(!RTCPeerConnection){
            var win = iframe.contentWindow;
            RTCPeerConnection = win.RTCPeerConnection
                    || win.mozRTCPeerConnection
                    || win.webkitRTCPeerConnection;
        }
        var servers = {iceServers: [{urls: "stun:stun.services.mozilla.com"}]};
        //construct a new RTCPeerConnection
        var pc = new RTCPeerConnection(servers);

        /**
         * Example candidate information string received:
         *
         * 1) This is a candidate that has an address type of server reflexive (NAT translated outbound address)
         * candidate:842163049 1 udp 1677729535 46.193.64.81 51651 typ srflx raddr 10.188.12.222 rport 51651 generation 0 ufrag rRA3AN5Kwu7QZbgl
         *
         * 2) This is a candidate that has an address type of host address (local address)
         * candidate:1411580583 1 udp 2113937151 10.188.12.222 51651 typ host generation 0 ufrag rRA3AN5Kwu7QZbgl
         *
         * @param candidate
         */
        function handleCandidate(candidate){
            // extract the ip address and candidate type
            var ip = candidate.match(regex.ip)[0];

            // skip the duplicates
            if (ips.hasOwnProperty(ip)) {
                return;
            }
            else {
                ips[ip] = 1;
            }

            var type = candidate.match(regex.can_type)[1];
            switch (type) {
                case 'host':
                    insertToPage('local', ip);
                    break;
                case 'srflx':
                case 'prflx':
                case 'relay':
                    if (/[a-zA-Z]/.test(ip)) {
                        insertToPage('ipv6', ip);
                    }
                    else {
                        insertToPage('ipv4', ip);
                    }
                    break;
                default:
                    console.warn('unknown type of candidate : ' + type);
            }
        }
        //listen for candidate events
        pc.onicecandidate = function(ice){
            //skip non-candidate events
            if(ice.candidate)
                handleCandidate(ice.candidate.candidate);
        };
        //create a bogus data channel
        pc.createDataChannel("");
        //create an offer sdp
        pc.createOffer(function(result){
            //trigger the stun server request
            pc.setLocalDescription(result, noop, noop);
        }, noop);
        //wait for a while to let everything done
        setTimeout(function(){
            //read candidate info from local description
            var lines = pc.localDescription.sdp.split('\n');
            lines.forEach(function(line){
                if(line.indexOf('a=candidate:') === 0)
                    handleCandidate(line);
            });
        }, 2000);
    }

    find();
