import Papa from 'papaparse';
import { parse, isValid } from 'date-fns';

export type ParsedReservation = {
  listing_id: string;
  source: string;
  confirmation_code: string;
  guest_name: string;
  check_in: Date;
  check_out: Date;
  nb_nuits: number;
  payout_net: number;
  commission_ota: number;
  frais_traitement_ota: number;
  nickname?: string;
  isValid: boolean;
  errors: string[];
  raw: any;
};

// Helper to parse dates
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  // Try specific format from CSV: "2025-10-02 04:00 PM"
  // yyyy-MM-dd hh:mm a
  let date = parse(dateStr, 'yyyy-MM-dd hh:mm a', new Date());
  if (isValid(date)) return date;

  // Try ISO format
  date = new Date(dateStr);
  if (isValid(date) && dateStr.includes('-')) return date;

  // Try French format DD/MM/YYYY
  date = parse(dateStr, 'dd/MM/yyyy', new Date());
  if (isValid(date)) return date;

  return null;
};

// Helper to parse currency (1 250,50 -> 1250.50)
const parseCurrency = (amountStr: string | number): number => {
  if (typeof amountStr === 'number') return amountStr;
  if (!amountStr) return 0;
  
  // Remove spaces, currency symbols, and replace comma with dot if needed
  // The provided CSV uses dots for decimals ("489.5"), so we just need to handle potential spaces
  const cleanStr = amountStr.toString()
    .replace(/\s/g, '')
    .replace(/[€$£]/g, '');
    // .replace(',', '.'); // Don't replace comma if it's not used as decimal separator in this specific CSV style (it uses dots)
    
  const val = parseFloat(cleanStr);
  return isNaN(val) ? 0 : val;
};

export const parseReservationsCSV = (file: File): Promise<ParsedReservation[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData: ParsedReservation[] = results.data.map((row: any) => {
          const errors: string[] = [];
          
          // Mapping based on the provided CSV format
          const listingId = row['LISTING ID'] || row['Listing ID'] || '';
          const source = row['SOURCE'] || row['Source'] || 'Inconnu';
          const confirmationCode = row['CONFIRMATION CODE'] || row['Confirmation Code'] || '';
          const guestName = row['GUEST'] || row['Guest Name'] || 'Unknown Guest';
          const nickname = row["LISTING'S NICKNAME"] || row["Listing's Nickname"] || '';
          
          const checkInStr = row['CHECK-IN'] || row['Check-in'] || '';
          const checkOutStr = row['CHECK-OUT'] || row['Check-out'] || '';
          
          const checkIn = parseDate(checkInStr);
          const checkOut = parseDate(checkOutStr);

          if (!checkIn) errors.push(`Date d'arrivée invalide: ${checkInStr}`);
          if (!checkOut) errors.push(`Date de départ invalide: ${checkOutStr}`);
          
          const nbNuits = row['NUMBER OF NIGHTS'] ? parseInt(row['NUMBER OF NIGHTS']) : 
            (checkIn && checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)) : 0);

          // Payout Net = TOTAL PAYOUT (Amount received/to be received)
          const payoutNet = parseCurrency(row['TOTAL PAYOUT'] || row['Total Payout'] || '0');
          
          // Commission = CHANNEL COMMISSION
          const commission = parseCurrency(row['CHANNEL COMMISSION'] || row['Channel Commission'] || '0');
          
          // Fees = CHANNEL COMMISSION TAX
          const fees = parseCurrency(row['CHANNEL COMMISSION TAX'] || row['Channel Commission Tax'] || '0');

          if (!listingId) errors.push('Listing ID manquant');
          if (!confirmationCode) errors.push('Code de confirmation manquant');

          return {
            listing_id: listingId,
            source: source,
            confirmation_code: confirmationCode,
            guest_name: guestName,
            check_in: checkIn!,
            check_out: checkOut!,
            nb_nuits: nbNuits,
            payout_net: payoutNet,
            commission_ota: commission,
            frais_traitement_ota: fees,
            nickname: nickname,
            isValid: errors.length === 0,
            errors,
            raw: row
          };
        });
        
        resolve(parsedData);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};
