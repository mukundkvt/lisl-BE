import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pdfFieldsConfig } from "../config/pdfConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadFont = async (pdfDoc, weight) => {
  try {
    const fontPath = path.join(
      __dirname,
      "../assets/fonts",
      `Inter-${weight}.ttf`
    );
    const fontBytes = await fs.readFile(fontPath);
    return await pdfDoc.embedFont(fontBytes);
  } catch (error) {
    return await pdfDoc.embedStandardFont(StandardFonts.Helvetica);
  }
};

const drawTextOnPage = async (page, text, config, pdfDoc, fonts) => {
  try {
    const {
      x = 50,
      y = 750,
      size = 12,
      letterSpacing = 0,
      lineHeight = 1.2,
      centerWithinWidth = null,
      widthForLineBreak = null,
      isCheckbox = false,
      font: { weight = 400 } = {},
      color = [0, 0, 0],
    } = config;

    const { height } = page.getSize();
    const pdfY = height - y;

    let font = fonts.get(weight) || (await loadFont(pdfDoc, weight));
    fonts.set(weight, font);

    if (!font) throw new Error("Failed to load font");

    const [r, g, b] = color.map((c) => Math.max(0, Math.min(1, c)));

    if (isCheckbox || config.isCross) {
      if (
        text &&
        (text === true ||
          text === 1 ||
          text === "yes" ||
          text === "true" ||
          text === "cross" ||
          text === "✓" ||
          text === "✕" ||
          text === "X")
      ) {
        const mark = config.isCross ? "X" : "✓";
        const textWidth = font.widthOfTextAtSize(mark, size);
        let adjustedX = x;
        if (centerWithinWidth && centerWithinWidth > textWidth) {
          adjustedX = x + (centerWithinWidth - textWidth) / 2;
        }
        page.drawText(mark, {
          x: adjustedX,
          y: pdfY,
          size,
          font,
          color: rgb(r, g, b),
        });
      }
    } else {
      const textWidth = font.widthOfTextAtSize(text.toString(), size);
      let adjustedX = x;
      if (centerWithinWidth && centerWithinWidth > textWidth) {
        adjustedX = x + (centerWithinWidth - textWidth) / 2;
      }

      if (letterSpacing > 0) {
        const chars = text.toString().split("");
        let currentX = adjustedX;
        for (const char of chars) {
          page.drawText(char, {
            x: currentX,
            y: pdfY,
            size,
            font,
            color: rgb(r, g, b),
          });
          const charWidth = font.widthOfTextAtSize(char, size);
          currentX += charWidth + letterSpacing;
        }
      } else if (widthForLineBreak) {
        const words = text.toString().split(" ");
        let currentLine = "";
        let currentY = pdfY;

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const testLine = currentLine === "" ? word : `${currentLine} ${word}`;
          const testWidth = font.widthOfTextAtSize(testLine, size);

          if (testWidth > widthForLineBreak && currentLine !== "") {
            page.drawText(currentLine, {
              x: adjustedX,
              y: currentY,
              size,
              font,
              color: rgb(r, g, b),
            });
            currentLine = word;
            currentY -= size * lineHeight;
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine !== "") {
          page.drawText(currentLine, {
            x: adjustedX,
            y: currentY,
            size,
            font,
            color: rgb(r, g, b),
          });
        }
      } else {
        page.drawText(text.toString(), {
          x: adjustedX,
          y: pdfY,
          size,
          font,
          color: rgb(r, g, b),
        });
      }
    }
  } catch (error) {
    console.error("Error drawing text:", error);
  }
};

export async function generateDemoPdf() {
  try {
    const templatePath = path.join(__dirname, "../assets/template.pdf");
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);

    const pages = pdfDoc.getPages();
    const fonts = new Map();

    const demoData = {
      currentDate: "06/09/2026",
      boId: "1208160012345678",
      clientCode: "LS99881",
      lsid: "LS10001",
      place: "MUMBAI",
      PAN: "ABCDE1234F",
      prefix: "MR",
      firstName: "RAHUL",
      middleName: "KUMAR",
      lastName: "SHARMA",
      fullName: "RAHUL KUMAR SHARMA",
      email: "rahul.sharma@example.com",
      DOB: "15/08/1990",
      mobileNumber: "9876543210",
      mobileNumberPrefix: "91",
      isApplicationTypeNew: true,
      isApplicationTypeUpdate: false,
      isAccountTypeNormal: true,

      fatherPrefix: "MR",
      fatherFirstName: "RAMESH",
      fatherMiddleName: "CHANDRA",
      fatherLastName: "SHARMA",
      motherPrefix: "MRS",
      motherFirstName: "SITA",
      motherMiddleName: "DEVI",
      motherLastName: "SHARMA",

      maskedAadhaarNumber: "XXXXXXXX1234",

      // Page 6 POI Dynamic Ticks & Fields
      isPassportTick: true,
      passportNumber: "Z1234567",
      passportExpiry: "12/10/2032",

      isVoterIdTick: true,
      voterIdNumber: "VOT9876543",

      isPanCardTick: true,
      PANMark: true,

      isDrivingLicenceTick: true,
      drivingLicenceNumber: "DL0420110012345",
      drivingLicenceExpiry: "25/05/2030",

      isAadhaarTick: true,
      AadhaarMark: true,

      isNregaTick: true,
      nregaNumber: "NRG8877665544",

      isOtherProofTick: true,
      otherDocumentName: "Govt ID Card",
      otherDocumentNumber: "GID998877",

      genderMale: true,
      genderFemale: false,
      isMarried: true,
      isUnmarried: false,
      isIndian: true,
      isResidentIndividual: true,

      isOccupation_privateSector: true,
      isOccupation_publicSector: false,
      isOccupation_business: false,
      isOccupation_professional: false,
      isOccupation_retired: false,
      isOccupation_houseWife: false,
      isOccupation_student: false,
      isOccupation_governmentService: false,
      isOccupation_others: false,

      currentAddressTicked: true,
      permanentAddressTick: true,
      isAddressTypeResidential: true,
      isAddressProofTypeAadhaar: true,

      currentAddressLine1: "Flat 402, Sunshine Heights",
      currentAddressLine2: "MG Road, Andheri East",
      currentAddressLine3: "Near Metro Station",
      currentAddressCity: "MUMBAI",
      currentAddressStateCode: "MH",
      currentAddressCountryCode: "IN",
      currentAddressPincode: "400069",

      permanentAddressLine1: "Flat 402, Sunshine Heights",
      permanentAddressLine2: "MG Road, Andheri East",
      permanentAddressLine3: "Near Metro Station",
      permanentAddressCity: "MUMBAI",
      permanentAddressStateCode: "MH",
      permanentAddressCountryCode: "IN",
      permanentAddressPincode: "400069",

      institutionName: "LAKSHMISHREE INVESTMENT AND SECURITIES LTD",
      institutionCode: "IN0571",
      IPVLatitude: "Latitude : 19.0760",
      IPVLongitude: "Longitude : 72.8777",
      IPVCapturedTime: "06/09/2026 14:30:00",

      isIncomeBelow1Lakh: false,
      isIncome1to5Lakh: true,
      isIncome5to10Lakh: false,
      isIncome10to25Lakh: false,
      isIncomeAbove25Lakh: false,
      netWorthValue: "500000",
      netWorthAsOnDate: "01/04/2026",

      iscCustomerClassificationOther: true,
      isCustomerClassificationFarmer: false,
      politicalExposedPersonCross: true,
      relatedPoliticalPersonCross: true,

      isBankAccountSaving: true,
      bankAccountNumber: "987654321098",
      bankAccountIFSCCode: "HDFC0001234",
      bankAccountBankName: "HDFC BANK",
      bankAccountBankAddress: "ANDHERI EAST BRANCH, MUMBAI",
      bankAccountBankMICRCode: "400240002",

      DP_CDSL_TICK: true,
      DPName: "Lakshmishree Investment & Securities Limited",
      DPid: "1208160012345678",
      DPidfirsteight: "12081600",
      DPidlasteight: "12345678",

      isElectronicContractNote: true,
      isInternetTrading: true,
      isNonPastAction: true,
      tradingExperienceYears: "1 - 5 years",
      isInvestementForTrading: true,
      notSelectedSegment: "NSECOMMODITY,MCXMCOMMODITY,NSESLB,BSESTARMF",
      isAutomaticCredit: true,
      isAccountStatementAsPerSebi: true,
      isAgreeToShareEmailToRTA: true,
      isHoldingStatementOnEmail: true,
      isAnnualStatementOnEmail: true,
      isDpAcceptedAllPledges: true,
      isNonAccountOpeningPowerOfAttorney: false,
      isAccountOpeningPowerOfAttorney: true,
      isWishToRecieveDivident: true,
      isSMSonSelf: true,
      isDDPIGrantedMobile: true,
      isHighValueTransactionTrading: true,
      isNonUSAPerson: true,
      isIndianTaxResident: true,
      isIndiaCitizen: true,
      isDISSlipBookRequied: true,
      isDISSlipBookNotRequied: false,
      isKYCDocumentOnEmail: true,

      firstNomineeName: "PRIYA SHARMA",
      firstNomineeShare: "50",
      firstNomineeRelation: "SPOUSE",
      firstNomineeDateOfBirth: "20/06/1992",
      firstNomineeGuadianName: "",
      firstNomineeMobile: "9876543210",
      firstNomineeEmail: "priya.sharma@example.com",
      firstNomineeAddress: "Flat 101, Galaxy Apartments, Linking Road, Bandra West, Mumbai, Maharashtra, India",
      firstNomineePINCode: "400050",
      firstNomineeIdentification: "PAN - ABCDE1234F",
      firstNomineeIdentifycationtype: "PAN",
      firstNomineeIdentificationType: "PAN",
      firstNomineeIdentificationNumber: "ABCDE1234F",

      secondNomineeName: "ROHIT SHARMA",
      secondNomineeShare: "30",
      secondNomineeRelation: "BROTHER",
      secondNomineeDateOfBirth: "15/08/1995",
      secondNomineeGuadianName: "RAMESH SHARMA",
      secondNomineeMobile: "9812345678",
      secoundNomineeMobile: "9812345678",
      secondNomineeEmail: "rohit.sharma@example.com",
      secondNomineeAddress: "Plot 42, Sector 15, Near City Center Mall, Vashi, Navi Mumbai, Maharashtra, India",
      secondNomineePINCode: "400703",
      secondNomineeIdentification: "Aadhaar - 987654321098",
      secondNomineeIdentifycationtype: "Aadhaar",
      secondNomineeIdentificationType: "Aadhaar",
      secondNomineeIdentificationNumber: "987654321098",

      thirdNomineeName: "ANITA SHARMA",
      thirdNomineeShare: "20",
      thirdNomineeRelation: "MOTHER",
      thirdNomineeDateOfBirth: "10/12/1970",
      thirdNomineeGuadianName: "RAMESH SHARMA",
      thirdNomineeMobile: "9898765432",
      thirdNomineeEmail: "anita.sharma@example.com",
      thirdNomineeAddress: "House No 7, Green Park Colony, Civil Lines, Kanpur, Uttar Pradesh, India",
      thirdNomineePINCode: "208001",
      thirdNomineeIdentification: "Passport - Z1234567",
      thirdNomineeIdentifycationtype: "Passport",
      thirdNomineeIdentificationType: "Passport",
      thirdNomineeIdentificationNumber: "Z1234567",

      nominee1ClientFullName: "GAURAV SHARMA",
      nominee2ClientFullName: "GAURAV SHARMA",
      nominee3ClientFullName: "GAURAV SHARMA",

      IsNomnieePresent: "Yes",
      isNomineePresent: "Yes",

      isPeriodicStatementMonthly: true,
      isPeriodicStatementQuaterly: false,
      isENCEmailComunication: true,
      isAuthorizedToDebitDepositoryCharges: true,
      isRequestCommodityForward: true,
      isAcceptedSecuritiesAsColleteralForALLSegments: true,
    };

    for (const [fieldName, value] of Object.entries(demoData)) {
      const fieldConfigs = pdfFieldsConfig[fieldName];
      if (!fieldConfigs) continue;
      if (value === undefined || value === null || value === "") continue;

      if (Array.isArray(fieldConfigs)) {
        for (const config of fieldConfigs) {
          const pageIndex = config.page - 1;
          if (pageIndex < pages.length) {
            await drawTextOnPage(pages[pageIndex], value, config, pdfDoc, fonts);
          }
        }
      }
    }

    const outBytes = await pdfDoc.save();

    const publicDir = path.join(__dirname, "../public");
    const uploadsDir = path.join(__dirname, "../uploads");
    await fs.mkdir(publicDir, { recursive: true });
    await fs.mkdir(uploadsDir, { recursive: true });

    await fs.writeFile(path.join(publicDir, "demo_kyc.pdf"), outBytes);
    await fs.writeFile(path.join(publicDir, "demokyc.pdf"), outBytes);
    await fs.writeFile(path.join(uploadsDir, "demo_kyc.pdf"), outBytes);
    await fs.writeFile(path.join(uploadsDir, "demokyc.pdf"), outBytes);

    console.log("✅ [DEV] Demo KYC PDF generated successfully on startup.");
  } catch (err) {
    console.error("❌ [DEV] Failed to generate Demo KYC PDF:", err);
  }
}
