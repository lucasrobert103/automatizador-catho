const puppeteer = require('puppeteer');
const fs = require('fs');

async function automateLoginAndSearch() {
    let jobTitle = getNewJobTitleFromTextFile();

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 50,
    });

    const page = await browser.newPage();

    // Handle new tabs
    browser.on('targetcreated', (target) => {
        if (target.type() === 'page' && target.url() !== page.url()) {
            target.page().then((newPage) => {
                newPage.close();
            });
        }
    });

    console.log('Acessando a página de login...');
    await page.goto('https://seguro.catho.com.br/signin/');

    await page.mouse.click(1, 1);
    await page.waitForSelector('button.acceptAll.widget-policy-button.widget-policy-button--blue');
    await page.click('button.acceptAll.widget-policy-button.widget-policy-button--blue');
    console.log('Cookies aceitos com sucesso!');

    // const username = 'seu email';
    // const password = 'sua senha';
    console.log('Inserindo credenciais de login...');
    await page.type('input[name="email"]', username);
    await page.type('input[name="password"]', password);
    await page.click('button.Button__StyledButton-sc-1ovnfsw-1');
    await page.waitForNavigation();
    console.log('Login realizado com sucesso!');

    let pages = 1;
    let maxPages = 256;
    let consecutiveFailures = 0;

    while (pages <= maxPages) {
        console.log(`Acessando a página de busca de empregos para o cargo ${jobTitle} - Página ${pages}...`);
        await page.goto(await constructJobSearchURL(jobTitle, pages));

        const maxCandidaturasComSucesso = 256;
        let candidaturasComSucesso = 0;

        const elementosCandidatura = await page.$$('button.cqioez');

        for (const button of elementosCandidatura) {
            try {
                console.log(`Tentando candidatura ${candidaturasComSucesso + 1}...`);

                await button.click();
                await preencherFormulario(page);
                await verificarEnviarCurriculo(page);
                console.log('Candidatura realizada com sucesso!');

                candidaturasComSucesso++;

                if (candidaturasComSucesso >= maxCandidaturasComSucesso) {
                    console.log(`Atingido o número máximo de ${maxCandidaturasComSucesso} candidaturas com sucesso.`);
                    break;
                }

                await verificarFecharDialogo(page);
                await verificarEFecharElemento(page);

                const agoraNaoButton = await page.$('#apply-modal-ok-button');
                if (agoraNaoButton) {
                    console.log('Elemento "Agora não" encontrado. Clicando...');
                    await agoraNaoButton.click();
                }
            } catch (error) {
                console.error(`Erro durante o processo: ${error.message}`);
                console.log('Tentando o próximo elemento de candidatura...');
            }
        }

        if (elementosCandidatura.length === 0) {
            consecutiveFailures++;

            if (consecutiveFailures >= 50) {
                console.log(`Não foram encontradas vagas para o cargo ${jobTitle} nas últimas 10 páginas. Buscando nova palavra-chave no arquivo de texto...`);
                jobTitle = getNewJobTitleFromTextFile();
                consecutiveFailures = 0;
                pages = 1;
            }

            console.log(`Não foram encontradas vagas para o cargo ${jobTitle} na página ${pages}. Procurando em arquivo de texto...`);
            await buscarVagasEmArquivo(jobTitle);
        } else {
            consecutiveFailures = 0;
        }

        pages++;
    }

    console.log('Processo de candidatura concluído.');
    // Mantenha o navegador aberto para inspeção manual
    // await browser.close();
}

async function constructJobSearchURL(jobTitle, currentPage) {
    // Remove espaços extras e substitui espaços por hifens
    jobTitle = jobTitle.trim().replace(/\s+/g, '-');

    // Constrói a URL
    let searchURL = `https://www.catho.com.br/vagas/${jobTitle}/?page=${currentPage}&exclude_aggregator=true`;

    // Verifica se o cargo está presente na URL
    if (!searchURL.includes(jobTitle)) {
        // Adiciona o cargo à URL
        searchURL = `https://www.catho.com.br/vagas/${jobTitle}/${searchURL.substring(searchURL.indexOf('?'))}`;
    }

    return searchURL;
}

function getNewJobTitleFromTextFile() {
    try {
        const arquivoTexto = fs.readFileSync('texto.txt', 'utf8');
        const linhas = arquivoTexto.split('\n');
        const randomLine = linhas[Math.floor(Math.random() * linhas.length)];
        return randomLine.trim();
    } catch (error) {
        console.error(`Erro ao ler o arquivo de texto: ${error.message}`);
        return '';
    }
}

async function buscarVagasEmArquivo(jobTitle) {
    try {
        const arquivoTexto = fs.readFileSync('texto.txt', 'utf8');
        const linhas = arquivoTexto.split('\n');
        const regex = new RegExp(jobTitle, 'i');

        for (const linha of linhas) {
            if (regex.test(linha)) {
                console.log(`Encontrada uma vaga relacionada ao cargo ${jobTitle} no arquivo de texto.`);
                return;
            }
        }

        console.log(`Nenhuma vaga encontrada para o cargo ${jobTitle} no arquivo de texto.`);
    } catch (error) {
        console.error(`Erro ao ler o arquivo de texto: ${error.message}`);
    }
}

async function verificarEnviarCurriculo(page) {
    try {
        // Remove 'required' attribute from all form elements
        await page.evaluate(() => {
            const formElements = document.querySelectorAll('form [required]');
            formElements.forEach((element) => {
                element.removeAttribute('required');
            });
        });

        await page.waitForSelector('button.Button__StyledButton-sc-1ovnfsw-1.lloNUs', { timeout: 1000 });
        await page.click('button.Button__StyledButton-sc-1ovnfsw-1.lloNUs');
        console.log('Clicou em "Enviar meu currículo". Aguardando confirmação...');

        await page.waitForTimeout(5000);

        const enviarCurriculoButton = await page.$('button.Button__StyledButton-sc-1ovnfsw-1.lloNUs');
        if (enviarCurriculoButton) {
            console.log('Confirmação: Candidatura bem-sucedida!');
        } else {
            console.log('Confirmação: Candidatura não confirmada após 4 segundos.');
        }
    } catch (error) {
        console.log('Botão para enviar currículo não encontrado após 2 segundos. Continuando...');
    }
}

async function verificarFecharDialogo(page) {
    try {
        await preencherFormulario(page);
        await verificarEnviarCurriculo(page);
        await page.waitForSelector('button.Button__StyledButton-sc-1ovnfsw-1.dNcwnT', { timeout: 500 });
        await page.click('button.Button__StyledButton-sc-1ovnfsw-1.dNcwnT');
        console.log('Clicou no botão de fechar diálogo.');
    } catch (error) {
        console.log('Botão de fechar diálogo não encontrado após 2 segundos. Continuando...');
    }
}

async function verificarEFecharElemento(page) {
    try {
        await page.waitForSelector('div.Frame__NA70B img.image', { timeout: 500 });
        await page.click('div.Frame__NA70B img.image');
        console.log('Clicou no elemento para fechar.');
    } catch (error) {
        console.log('Elemento para fechar não encontrado após 2 segundos. Continuando...');
    }
}

// async function preencherFormulario(form) {
//     console.log('Preenchendo o formulário...');

//     // Find all labels within the form
//     const labels = await form.$$('label');

//     // Array para armazenar os rótulos que não têm um botão de rádio selecionado
//     const labelsSemRadio = [];

//     // Iterate over each label
//     for (const label of labels) {
//         const labelText = await label.evaluate(node => node.innerText.trim());

//         // Example: If the label contains the text "Sim"
//         if (labelText === 'Sim') {
//             // Find the associated radio button by checking for the input element with type="radio"
//             const radioInput = await label.$('input[type="radio"]');

//             // Check if the radio button is found and interact with it
//             if (radioInput) {
//                 // Click on the radio input directly, instead of the label
//                 await radioInput.click();
//                 console.log('Radio button selected for label:', labelText);
//             } else {
//                 // Se não houver botão de rádio, adicione o rótulo ao array de labelsSemRadio
//                 labelsSemRadio.push(labelText);
//             }
//         }
//     }

//     // Verifique se todos os grupos de botões de rádio foram preenchidos
//     if (labelsSemRadio.length > 0) {
//         console.warn('Alguns grupos de botões de rádio não foram preenchidos:', labelsSemRadio);
//     } else {
//         console.log('Todos os grupos de botões de rádio foram preenchidos com sucesso!');
//     }

//     // Read the content from texte-area.txt
//     try {
//         const content = fs.readFileSync('texte-area.txt', 'utf-8');

//         // Example: If you want to fill in textarea fields with the content from texte-area.txt
//         const textareas = await form.$$('textarea');
//         for (const textarea of textareas) {
//             // Use page.evaluate to set the value of the textarea
//             await textarea.evaluate((el, content) => el.value = content, content);
//         }

//         console.log('Formulário preenchido com sucesso!');
//     } catch (error) {
//         console.error('Erro ao ler o arquivo texte-area.txt:', error);
//     }
// }
async function preencherFormulario(form) {
    console.log('Preenchendo o formulário...');

    // Find all labels within the form
    const labels = await form.$$('label');

    // Array para armazenar os rótulos que não têm um botão de rádio selecionado
    const labelsSemRadio = [];

    // Iterate over each label
    for (const labelText of labelsSemRadio) {
        const label = labels.find(l => l.evaluate(node => node.innerText.trim()) === labelText);
        const radioInput = await label.$('input[type="radio"]');
        
        if (radioInput) {
            await radioInput.click();
            console.log('Radio button selected for label (auto):', labelText);
        }
    }

    // Verifique se todos os grupos de botões de rádio foram preenchidos
    if (labelsSemRadio.length > 0) {
        console.warn('Alguns grupos de botões de rádio não foram preenchidos. Preenchendo automaticamente...');

        // Preencha automaticamente os grupos de botões de rádio que não foram preenchidos
        for (const labelText of labelsSemRadio) {
            const label = labels.find(l => l.evaluate(node => node.innerText.trim()) === labelText);
            const radioInput = await label.$('input[type="radio"]');
            
            if (radioInput) {
                await radioInput.click();
                console.log('Radio button selected for label (auto):', labelText);
            }
        }

        console.log('Todos os grupos de botões de rádio foram preenchidos com sucesso!');
    } else {
        console.log('Todos os grupos de botões de rádio foram preenchidos com sucesso!');
    }

    // Restante do código para preencher áreas de texto...

    // Read the content from texte-area.txt
    try {
        const content = fs.readFileSync('texte-area.txt', 'utf-8');

        // Example: If you want to fill in textarea fields with the content from texte-area.txt
        const textareas = await form.$$('textarea');
        for (const textarea of textareas) {
            // Use page.evaluate to set the value of the textarea
            await textarea.evaluate((el, content) => el.value = content, content);
        }

        console.log('Formulário preenchido com sucesso!');
    } catch (error) {
        console.error('Erro ao ler o arquivo texte-area.txt:', error);
    }
}



automateLoginAndSearch();