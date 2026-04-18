fetch('https://quantum-autobot.pxxl.click/')
  .then(r => r.text())
  .then(html => {
    const match = html.match(/\/assets\/index-[a-zA-Z0-9]*\.js/);
    if (!match) return console.log('not found');
    console.log(match[0]);
    return fetch('https://quantum-autobot.pxxl.click' + match[0]).then(r => r.text());
  })
  .then(js => {
    if (js && js.includes('totalBalance===totalNeeded')) {
      console.log('FIX_IS_DEPLOYED');
    } else if (js) {
      console.log('OLD_CODE_DETECTED');
    }
  });
