import express from 'express';
import dns from 'dns/promises';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, './config.json');
const domainsPath = path.resolve(__dirname, './fulldomains.json');

const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const app = express();
const blockList = new Set(config.blockList || []);

try {
  await fs.access(domainsPath);
} catch {
  await fs.writeFile(domainsPath, JSON.stringify([]));
}

async function logDomain(domain) {
  try {
    const data = await fs.readFile(domainsPath, 'utf8');
    const domains = new Set(JSON.parse(data));

    if (!domains.has(domain)) {
      domains.add(domain);
      await fs.writeFile(domainsPath, JSON.stringify([...domains], null, 2));
    }
  } catch (err) {
    console.error('Error logging domain:', err);
  }
}

app.get('/', async (req, res) => {
  const domain = req.query.domain;

  if (!domain || blockList.has(domain)) {
    return res.status(400).send('Disallowed');
  }

  // **Log the domain directly** — do not log IPs
  await logDomain(domain);

  try {
    const addresses = await dns.resolve4(domain);
    const predefinedIPs = Array.isArray(config.ips) ? config.ips : [];
    const isValid = predefinedIPs.some(ip => addresses.includes(ip));

    if (isValid) {
      return res.status(200).send('DNS is pointing to the IP');
    } else {
      return res.status(403).send('DNS is not pointing to the IP');
    }
  } catch {
    return res.status(403).send('DNS resolution failed');
  }
});

const PORT = config.port || 3001;
app.listen(PORT, () => {
  console.log(`TLS server is running on port ${PORT}`);
});
