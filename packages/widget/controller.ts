import RelativeArticle from '.';
import { Controller } from './utils';
import { Component, Water, Request } from '@pjblog/http';
import { HttpNotFoundException } from '@typeservice/exception';
import { BlogTagRelativeEntity, ArticleDBO, numberic, TagDBO, BlogArticleEntity } from '@pjblog/core';
import { getNode } from '@pjblog/manager';
import { TypeORM } from '@pjblog/typeorm';
import type { EntityManager } from 'typeorm';

interface IArticle {
  title: string,
  id: number,
  code: string,
  ctime: string | Date,
}

export type IResponse = IArticle[];

@Controller('GET', '/:id(\\d+)')
export class RelativeArticlesController extends Component<IResponse> {
  public readonly manager: EntityManager;
  public readonly service: ArticleDBO;
  public readonly container: RelativeArticle;
  public readonly tag: TagDBO;

  constructor(req: Request) {
    super(req, []);
    this.manager = getNode(TypeORM).value.manager;
    this.container = getNode(RelativeArticle);
    this.service = new ArticleDBO(this.manager);
    this.tag = new TagDBO(this.manager);
  }

  @Water(1)
  public async getArticle() {
    const id = numberic(0)(this.req.params.id);
    if (!id) throw new HttpNotFoundException('找不到文章');
    const article = await this.service.getOne(id);
    if (!article) throw new HttpNotFoundException('找不到文章');
    return article;
  }

  @Water(2)
  public async getTags() {
    const article = this.getCache('getArticle');
    const tags = await this.tag.get(article.id);
    return tags.map(tag => tag.id);
  }

  @Water(3)
  public async getRelatives() {
    const article = this.getCache('getArticle');
    const tags = this.getCache('getTags');
    if (!tags.length) return;
    this.res = await this.manager.getRepository(BlogTagRelativeEntity).createQueryBuilder('rel')
      .leftJoin(BlogArticleEntity, 'art', 'art.id=rel.aid')
      .select('art.article_title', 'title')
      .addSelect('art.id', 'id')
      .addSelect('art.article_code', 'code')
      .addSelect('art.gmt_create', 'ctime')
      .distinct()
      .where('rel.tid IN (:...tids)', { tids: tags })
      .andWhere('rel.aid<>:aid', { aid: article.id })
      .limit(this.container.storage.get('articles'))
      .getRawMany<IArticle>();
  }
}