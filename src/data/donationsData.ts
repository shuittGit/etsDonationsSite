import { DonationRecord, UserSession } from '../types';

export const RAW_CSV_BACKUP = `userid,name,pin,non-profit,amount,date_donated
johnsond,David Johnson,7785,St. Jude Children's Research Hospital,1930.03,2026-01-01
brownl,Linda Brown,2468,The Nature Conservancy,1514.24,2026-01-04
taylorw,William Taylor,3194,World Wildlife Fund,2430.59,2026-01-06
brownl,Linda Brown,2468,Doctors Without Borders,1312.85,2026-01-14
millers,Sarah Miller,5820,Red Cross,649.72,2026-01-17
millers,Sarah Miller,5820,Salvation Army,734.85,2026-01-23
andersone,Elizabeth Anderson,4912,Doctors Without Borders,1790.97,2026-01-24
taylorw,William Taylor,3194,The Nature Conservancy,318.18,2026-01-25
andersone,Elizabeth Anderson,4912,Police Athletic League,117.26,2026-01-31
brownl,Linda Brown,2468,Habitat for Humanity,1867.53,2026-02-14
andersone,Elizabeth Anderson,4912,Feeding America,176.28,2026-02-17
taylorw,William Taylor,3194,Habitat for Humanity,1318.44,2026-02-24
andersone,Elizabeth Anderson,4912,St. Jude Children's Research Hospital,1272.65,2026-02-27
garciam,Maria Garcia,6301,American Cancer Society,1938.00,2026-03-07
millers,Sarah Miller,5820,Doctors Without Borders,2493.58,2026-03-12
millers,Sarah Miller,5820,United Way,804.40,2026-03-22
brownl,Linda Brown,2468,The Nature Conservancy,2037.99,2026-04-08
davism,Michael Davis,8520,Boys & Girls Clubs of America,1318.39,2026-04-12
brownl,Linda Brown,2468,American Cancer Society,1912.64,2026-04-13
millers,Sarah Miller,5820,Feeding America,742.58,2026-04-19
johnsond,David Johnson,7785,The Nature Conservancy,1010.69,2026-04-23
brownl,Linda Brown,2468,United Way,911.41,2026-04-28
brownl,Linda Brown,2468,World Wildlife Fund,2464.53,2026-04-30
millers,Sarah Miller,5820,World Wildlife Fund,674.69,2026-05-04
garciam,Maria Garcia,6301,Red Cross,1879.72,2026-05-06
garciam,Maria Garcia,6301,Salvation Army,1623.95,2026-05-06
moorej,Jennifer Moore,1943,American Cancer Society,1183.57,2026-05-07
johnsond,David Johnson,7785,Police Athletic League,1887.97,2026-05-15
moorej,Jennifer Moore,1943,Red Cross,2389.16,2026-05-15
wilsonr,Robert Wilson,9281,Boys & Girls Clubs of America,1201.24,2026-05-16
johnsond,David Johnson,7785,St. Jude Children's Research Hospital,952.65,2026-05-17
garciam,Maria Garcia,6301,Boys & Girls Clubs of America,2223.49,2026-05-17
johnsond,David Johnson,7785,ASPCA,1114.27,2026-05-23
brownl,Linda Brown,2468,United Way,2273.01,2026-06-19
johnsond,David Johnson,7785,Doctors Without Borders,2397.31,2026-06-22
garciam,Maria Garcia,6301,Police Athletic League,1681.56,2026-07-01
garciam,Maria Garcia,6301,United Way,1011.83,2026-07-03
garciam,Maria Garcia,6301,American Cancer Society,803.63,2026-07-05
garciam,Maria Garcia,6301,Feeding America,767.14,2026-07-06
davism,Michael Davis,8520,Feeding America,2488.36,2026-07-11
moorej,Jennifer Moore,1943,American Cancer Society,399.58,2026-07-13
andersone,Elizabeth Anderson,4912,Feeding America,2254.77,2026-07-24
taylorw,William Taylor,3194,Doctors Without Borders,1818.45,2026-08-03
garciam,Maria Garcia,6301,Habitat for Humanity,1605.87,2026-08-05
moorej,Jennifer Moore,1943,American Cancer Society,496.30,2026-08-05
andersone,Elizabeth Anderson,4912,United Way,1023.44,2026-08-28
brownl,Linda Brown,2468,American Cancer Society,417.55,2026-08-31
andersone,Elizabeth Anderson,4912,United Way,305.57,2026-09-06
garciam,Maria Garcia,6301,American Cancer Society,671.21,2026-09-06
andersone,Elizabeth Anderson,4912,ASPCA,855.23,2026-09-13`;

export function parseCsvText(csvText: string): DonationRecord[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const records: DonationRecord[] = [];

  const userIdIdx = headers.indexOf('userid');
  const nameIdx = headers.indexOf('name');
  const pinIdx = headers.indexOf('pin');
  const nonProfitIdx = headers.indexOf('non-profit');
  const amountIdx = headers.indexOf('amount');
  const dateDonatedIdx = headers.indexOf('date_donated');

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Handle standard CSV or quotes if present
    const values: string[] = [];
    let insideQuotes = false;
    let currentVal = '';

    for (let charIndex = 0; charIndex < rawLine.length; charIndex++) {
      const char = rawLine[charIndex];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim());

    if (values.length >= 5) {
      const userId = values[userIdIdx] ?? '';
      const name = values[nameIdx] ?? '';
      const pin = pinIdx !== -1 ? values[pinIdx] : '';
      const nonProfit = values[nonProfitIdx] ?? '';
      const amountStr = values[amountIdx] ?? '0';
      const dateDonated = values[dateDonatedIdx] ?? '';

      records.push({
        userId,
        name,
        pin,
        nonProfit,
        amount: parseFloat(amountStr.replace(/[^0-9.-]+/g, '')) || 0,
        dateDonated,
      });
    }
  }

  return records;
}

export async function fetchDonations(): Promise<DonationRecord[]> {
  try {
    const response = await fetch('/donations.csv');
    if (!response.ok) {
      throw new Error(`Failed to load donations.csv: status ${response.status}`);
    }
    const text = await response.text();
    const parsed = parseCsvText(text);
    if (parsed.length > 0) {
      return parsed;
    }
    return parseCsvText(RAW_CSV_BACKUP);
  } catch {
    return parseCsvText(RAW_CSV_BACKUP);
  }
}

export function authenticateUser(
  rawUserId: string,
  rawPin: string,
  records: DonationRecord[]
): { success: boolean; session?: UserSession; error?: string } {
  const cleanUserId = rawUserId.trim().toLowerCase();
  const cleanPin = rawPin.trim();

  if (!cleanUserId || !cleanPin) {
    return {
      success: false,
      error: 'Incorrect Login, Please try again!',
    };
  }

  // Check admin credentials
  if (cleanUserId === 'admin' && cleanPin === '1234') {
    return {
      success: true,
      session: {
        username: 'admin',
        name: 'System Administrator',
        isAdmin: true,
        loginTime: new Date().toISOString(),
      },
    };
  }

  // Check matching standard user records from CSV
  const userRecords = records.filter(
    r => r.userId.trim().toLowerCase() === cleanUserId
  );

  if (userRecords.length === 0) {
    return {
      success: false,
      error: 'Incorrect Login, Please try again!',
    };
  }

  // Verify PIN matches the record
  const matchingPin = userRecords.some(r => r.pin === cleanPin);

  if (!matchingPin) {
    return {
      success: false,
      error: 'Incorrect Login, Please try again!',
    };
  }

  return {
    success: true,
    session: {
      username: userRecords[0].userId,
      name: userRecords[0].name,
      isAdmin: false,
      loginTime: new Date().toISOString(),
    },
  };
}
