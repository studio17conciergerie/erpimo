import { DecaissementSynthese } from './redditionApi';
import { format } from 'date-fns';

export interface AgenceConfig {
  nom: string;
  iban: string;
  bic: string;
}

export const sepaGenerator = {
  generateSCT(proprietaires: DecaissementSynthese[], dateCible: string, agence: AgenceConfig): string {
    const periode = format(new Date(dateCible), 'yyyyMM');
    const msgId = `RED-${periode}-${Date.now()}`;
    const creDtTm = new Date().toISOString().split('.')[0];
    const nbOfTxs = proprietaires.length;
    const ctrlSum = proprietaires.reduce((sum, p) => sum + p.soldeACeJour, 0).toFixed(2);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <InitgPty>
        <Nm>${agence.nom}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>RED-${periode}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${nbOfTxs}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${dateCible}</ReqdExctnDt>
      <Dbtr>
        <Nm>${agence.nom}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${agence.iban.replace(/\s/g, '')}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${agence.bic.replace(/\s/g, '')}</BIC>
        </FinInstnId>
      </DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>`;

    proprietaires.forEach((prop) => {
      const endToEndId = `RED-${periode}-${prop.code}`;
      const amt = prop.soldeACeJour.toFixed(2);
      const cdtrNm = `${prop.nom} ${prop.prenom}`.trim();
      const cdtrIban = prop.iban?.replace(/\s/g, '') || '';

      xml += `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${endToEndId}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${amt}</InstdAmt>
        </Amt>
        <CdtrAgt>
          <FinInstnId>
            <Othr>
              <Id>NOTPROVIDED</Id>
            </Othr>
          </FinInstnId>
        </CdtrAgt>
        <Cdtr>
          <Nm>${cdtrNm}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${cdtrIban}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>Reddition ${format(new Date(dateCible), 'MMMM yyyy')} - ${prop.nom}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`;
    });

    xml += `
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

    return xml;
  },

  downloadXML(xml: string, filename: string) {
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};
