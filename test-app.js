// Test script for PSN Trophy Tracker

const http = require('http');

async function testApp() {
    console.log('Testing PSN Trophy Tracker application...');
    
    // Test 1: Check API status
    console.log('\n1. Testing API status...');
    const statusRes = await makeRequest('/api/status');
    console.log(`API Status: ${statusRes.status === 'OK' ? 'OK ✓' : 'Failed ✗'}`);
    console.log(`PSN API Connected: ${statusRes.psnApiConnected ? 'Yes ✓' : 'No ✗'}`);
    
    // Test 2: Create overlay
    console.log('\n2. Testing overlay creation...');
    const createRes = await makeRequest('/api/create-overlay?psnId=borshkabor');
    if (createRes.success) {
        console.log(`Created Overlay: Success ✓`);
        console.log(`Overlay ID: ${createRes.overlayId}`);
        
        // Test 3: Get profile data for the overlay
        console.log('\n3. Testing profile data retrieval...');
        const profileRes = await makeRequest(`/api/profile-data?overlayId=${createRes.overlayId}`);
        if (profileRes.success) {
            console.log(`Profile Data: Success ✓`);
            console.log(`PSN ID: ${profileRes.profile.onlineId}`);
            console.log(`Trophy Level: ${profileRes.profile.trophySummary.trophyLevel}`);
            console.log(`Trophies: Platinum: ${profileRes.profile.trophySummary.earnedTrophies.platinum}, Gold: ${profileRes.profile.trophySummary.earnedTrophies.gold}, Silver: ${profileRes.profile.trophySummary.earnedTrophies.silver}, Bronze: ${profileRes.profile.trophySummary.earnedTrophies.bronze}`);
            
            // Test 4: Access the overlay page
            console.log('\n4. Testing overlay page access...');
            const overlayRes = await makeRawRequest(`/overlay/${createRes.overlayId}`);
            if (overlayRes.includes('<!DOCTYPE html>')) {
                console.log(`Overlay Page: Success ✓`);
            } else {
                console.log(`Overlay Page: Failed ✗`);
            }
        } else {
            console.log(`Profile Data: Failed ✗`);
            console.log(`Error: ${profileRes.error || 'Unknown error'}`);
        }
    } else {
        console.log(`Created Overlay: Failed ✗`);
        console.log(`Error: ${createRes.error || 'Unknown error'}`);
    }
    
    console.log('\nAll tests completed!');
}

// Helper function to make HTTP requests and parse JSON responses
function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: 'GET'
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message}`));
                }
            });
        });
        
        req.on('error', (e) => {
            reject(new Error(`Request failed: ${e.message}`));
        });
        
        req.end();
    });
}

// Helper function to make HTTP requests and return raw responses
function makeRawRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: 'GET'
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve(data);
            });
        });
        
        req.on('error', (e) => {
            reject(new Error(`Request failed: ${e.message}`));
        });
        
        req.end();
    });
}

// Run the tests
testApp().catch(err => {
    console.error('Test error:', err.message);
});