/**
 * 文档转化服务
 * 支持多种文件格式的自动转化
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const CONVERTED_DIR = process.env.CONVERTED_DIR || './converted';

class DocumentConverter {
    constructor() {
        this.supportedFormats = {
            '.pdf': 'pdf',
            '.docx': 'word',
            '.doc': 'word',
            '.xlsx': 'excel',
            '.xls': 'excel',
            '.pptx': 'powerpoint',
            '.md': 'markdown',
            '.txt': 'text',
            '.html': 'html',
            '.htm': 'html',
            '.json': 'json',
            '.csv': 'csv'
        };
    }

    async ensureDirs() {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        await fs.mkdir(CONVERTED_DIR, { recursive: true });
    }

    getFileInfo(filename) {
        const ext = path.extname(filename).toLowerCase();
        const format = this.supportedFormats[ext];
        return {
            extension: ext,
            format: format || 'unknown',
            supported: !!format
        };
    }

    async convert(file, userId) {
        await this.ensureDirs();
        
        const fileInfo = this.getFileInfo(file.originalname);
        
        if (!fileInfo.supported) {
            throw new Error(`不支持的文件格式: ${fileInfo.extension}`);
        }

        const jobId = uuidv4();
        const result = {
            jobId,
            originalName: file.originalname,
            format: fileInfo.format,
            size: file.size,
            userId,
            status: 'processing',
            createdAt: new Date().toISOString()
        };

        try {
            let content = '';
            
            switch (fileInfo.format) {
                case 'pdf':
                    content = await this.convertPdf(file.buffer);
                    break;
                case 'word':
                    content = await this.convertWord(file.buffer);
                    break;
                case 'excel':
                    content = await this.convertExcel(file.buffer);
                    break;
                case 'powerpoint':
                    content = await this.convertPowerPoint(file.buffer);
                    break;
                case 'markdown':
                case 'text':
                    content = file.buffer.toString('utf-8');
                    break;
                case 'html':
                    content = await this.convertHtml(file.buffer);
                    break;
                case 'json':
                    content = await this.convertJson(file.buffer);
                    break;
                case 'csv':
                    content = await this.convertCsv(file.buffer);
                    break;
                default:
                    throw new Error(`未实现的转化器: ${fileInfo.format}`);
            }

            result.status = 'completed';
            result.content = content;
            result.contentLength = content.length;
            result.completedAt = new Date().toISOString();

            logger.info(`文档转化完成: ${file.originalname} -> ${content.length} 字符`);

            return result;

        } catch (error) {
            result.status = 'failed';
            result.error = error.message;
            logger.error(`文档转化失败: ${file.originalname} - ${error.message}`);
            throw error;
        }
    }

    async convertPdf(buffer) {
        try {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            return data.text || '';
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                return `[PDF转化需要安装 pdf-parse: npm install pdf-parse]\n文件大小: ${buffer.length} 字节`;
            }
            throw error;
        }
    }

    async convertWord(buffer) {
        try {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawFromBuffer(buffer);
            return result.value || '';
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                return `[Word转化需要安装 mammoth: npm install mammoth]\n文件大小: ${buffer.length} 字节`;
            }
            throw error;
        }
    }

    async convertExcel(buffer) {
        try {
            const XLSX = require('xlsx');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            let content = '';
            
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(sheet);
                content += `## 工作表: ${sheetName}\n\n${csv}\n\n`;
            });
            
            return content;
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                return `[Excel转化需要安装 xlsx: npm install xlsx]\n文件大小: ${buffer.length} 字节`;
            }
            throw error;
        }
    }

    async convertPowerPoint(buffer) {
        try {
            return `[PowerPoint转化]\n文件大小: ${buffer.length} 字节\n提示: pptx格式支持需要额外配置`;
        } catch (error) {
            throw error;
        }
    }

    async convertHtml(buffer) {
        try {
            const cheerio = require('cheerio');
            const $ = cheerio.load(buffer.toString('utf-8'));
            
            $('script').remove();
            $('style').remove();
            $('nav').remove();
            $('header').remove();
            $('footer').remove();
            
            return $('body').text().replace(/\s+/g, ' ').trim();
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                const html = buffer.toString('utf-8');
                return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            }
            throw error;
        }
    }

    async convertJson(buffer) {
        try {
            const json = JSON.parse(buffer.toString('utf-8'));
            return '```json\n' + JSON.stringify(json, null, 2) + '\n```';
        } catch (error) {
            throw new Error('JSON解析失败: ' + error.message);
        }
    }

    async convertCsv(buffer) {
        const content = buffer.toString('utf-8');
        const lines = content.split('\n');
        let result = '';
        
        lines.forEach((line, index) => {
            if (line.trim()) {
                const cells = line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
                result += cells.join(' | ') + '\n';
            }
        });
        
        return result;
    }

    getSupportedFormats() {
        return Object.keys(this.supportedFormats).map(ext => ({
            extension: ext,
            format: this.supportedFormats[ext]
        }));
    }
}

module.exports = new DocumentConverter();
