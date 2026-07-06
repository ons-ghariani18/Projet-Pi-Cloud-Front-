export enum TypeQuestion {
    QCM = 'QCM',
    OUVERTE = 'OUVERTE'
}

export interface QuestionTest {
    id?: number;
    type: TypeQuestion;
    texte: string;
    points: number;
    choixA?: string;
    choixB?: string;
    choixC?: string;
    choixD?: string;
    bonneReponse?: string;
    shuffledOptions?: any[];
}

export interface TestFormation {
    id?: number;
    formationId?: number; // Simplified referencing for frontend
    formation?: any;
    heureFixeDebut: Date;
    dureeMinutes: number;
    scoreSeuil: number;
    questions?: QuestionTest[];
}

export interface ReponseTest {
    id?: number;
    questionTest: QuestionTest;
    reponseFournie: string;
    pointsObtenus?: number;
}

export interface SoumissionTest {
    id?: number;
    testFormation: TestFormation;
    entrepreneur: any;
    scoreObtenu: number;
    estCorrige: boolean;
    dateSoumission: Date;
    infractionsDetectees: number;
    tentativeFraude: boolean;
    reponses?: ReponseTest[];
}
